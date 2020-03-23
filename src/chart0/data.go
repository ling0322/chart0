package main

import (
	"crypto/tls"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v7"
	"github.com/pkg/errors"
)

const (
	StateDailyAPI      = "https://covidtracking.com/api/states/daily"
	DailyAPI           = "https://covidtracking.com/api/us/daily"
	MostRecentAPI      = "https://covidtracking.com/api/us"
	StateMostRecentAPI = "https://covidtracking.com/api/states"
)

const (
	DataTTL       = time.Minute * 30
	MostRecentTTL = time.Minute * 10
)

// Represents a date
type Date struct {
	time.Time
}

// US daily record from covidtracking.com
type DailyRecord struct {
	Date     *Date  `json:"date,omitempty"`
	States   int    `json:"states,omitempty"`
	State    string `json:"state,omitempty"`
	Positive int    `json:"positive"`
	Negative int    `json:"negative"`
	PosNeg   int    `json:"posNeg"`
	Pending  int    `json:"pending"`
	Death    int    `json:"death"`
	Total    int    `json:"total"`
}

// Stores total and new positive for specific day
type DailyTotalAndNewPositive struct {
	Date          time.Time `json:"date"`
	TotalPositive int       `json:"totalPositive"`
	NewPositive   int       `json:"newPositive"`
}

// Stores total and new positive for specific day
type DailyPositiveNegativeTest struct {
	Date     time.Time `json:"date"`
	Negative int       `json:"negative"`
	Positive int       `json:"positive"`
}

// Stores daily record and its diff with previous day
type RecordAndDiff struct {
	Record DailyRecord `json:"record"`
	Diff   DailyRecord `json:"diff"`
}

// Stores all data needed for chart0
type Data struct {
	westUSLocation *time.Location
	redisClient    *redis.Client
}

const DateLayout = "20060102"

// Create a new instance of data
func NewData(redisUrl string, redisPasswd string) *Data {
	location, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		log.Fatalln(err)
	}

	d := &Data{}
	d.westUSLocation = location

	// Get executable hash
	executablePath, err := os.Executable()
	log.Printf("%s: executable path: %s\n", INFO, executablePath)

	// Create redis connection
	client := redis.NewClient(&redis.Options{
		Addr:      redisUrl,
		Password:  redisPasswd, // no password set
		DB:        0,           // use default DB
		TLSConfig: &tls.Config{},
	})
	pong, err := client.Ping().Result()
	log.Printf("%s: get redis pong: %+v\n", INFO, pong)
	if err != nil {
		log.Fatalln(err)
	}
	d.redisClient = client

	return d
}

func (d *Date) UnmarshalJSON(b []byte) (err error) {
	s := strings.Trim(string(b), "\"")
	d.Time, err = time.Parse(DateLayout, s)
	return
}

func (d *Date) MarshalJSON() ([]byte, error) {
	return d.Time.MarshalJSON()
}

// fetchAndUnmarshal fetches data from url and unmarshal to object
func (d *Data) fetchObject(
	url string,
	cacheTTL time.Duration,
	object interface{}) error {
	// Fetch from redis
	ok := true
	cachedAPI, err := d.redisClient.HGetAll("apicache:" + url).Result()
	if err != nil {
		log.Printf("%s: redis cache not found %s\n", INFO, url)
		ok = false
	}

	cachedBody := ""
	var ts int64
	if ok {
		// API cache matched, parse timestamp
		cachedBody = cachedAPI["body"]
		ts, err = strconv.ParseInt(cachedAPI["ts"], 10, 64)
		if err != nil {
			log.Printf("%s: timestamp parse failed %s\n", WARNING, cachedAPI["ts"])
			ok = false
		}
	}
	if ok {
		// Check TTL
		if time.Now().Sub(time.Unix(ts, 0)) > cacheTTL {
			log.Printf("%s: cache outdated %s\n", INFO, url)
			ok = false
		}
	}
	if ok {
		// Try unmarshal
		err = json.Unmarshal([]byte(cachedBody), object)
		if err == nil {
			return nil
		}
	}

	// Here cache not match, we start fetch API
	log.Printf("%s: fetch url %s\n", INFO, url)
	ok = true
	body := []byte("")
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("%s: fetch url failed %s, %+v\n", ERROR, url, errors.WithStack(err))
		ok = false
	}
	if ok {
		defer resp.Body.Close()
		body, err = ioutil.ReadAll(resp.Body)
		if err != nil {
			log.Printf("%s: fetch url failed %s, %+v\n", ERROR, url, errors.WithStack(err))
			ok = false
		}
	}
	if ok {
		bodyTrim := strings.TrimSpace(string(body))
		if bodyTrim == "" || bodyTrim == "[]" || bodyTrim == "{}" {
			log.Printf("%s: body is empty: %s\n", ERROR, body)
			ok = false
		}
	}
	if ok {
		err = json.Unmarshal(body, object)
		if err != nil {
			log.Printf("%s: unmarshal failed %s, body is: %s\n", ERROR, err, body)
			ok = false
		}
	}
	if ok {
		// Update redis cache
		go func() {
			ts := strconv.FormatInt(time.Now().Unix(), 10)
			err := d.redisClient.HSet("apicache:"+url, "body", body, "ts", ts).Err()
			if err != nil {
				log.Printf("%s: update redis cache failed: %s\n", ERROR, err)
			}
		}()

		return nil
	}

	// If fetch API failed, we fall back to cache
	ok = true
	if cachedBody != "" {
		log.Printf("%s: fallback to outdated cache %s\n", WARNING, url)
		err = json.Unmarshal([]byte(cachedBody), object)
		if err != nil {
			log.Printf("%s: unmarshal failed %s, body is: %s\n", ERROR, err, body)
			ok = false
		}
	}
	if ok {
		// Update redis cache, avoid too many API calls when API was broken
		go func() {
			ts := strconv.FormatInt(time.Now().Unix(), 10)
			err := d.redisClient.HSet("apicache:"+url, "ts", ts).Err()
			if err != nil {
				log.Printf("%s: update redis cache failed: %s\n", ERROR, err)
			}
		}()

		return nil
	}

	return errors.Wrap(err, "fetchObject failed")
}

// fetchStateDaily fetches state daily data from covidtracking.com API
func (d *Data) getUSStateDaily() []DailyRecord {
	stateDaily := []DailyRecord{}
	if err := d.fetchObject(StateDailyAPI, DataTTL, &stateDaily); err != nil {
		log.Printf("%s: getUSStateDaily() failed: %+v\n", ERROR, err)
	}

	return stateDaily
}

// fetchStateMostRecent most recent data of state
func (d *Data) getUSStateMostRecent() []DailyRecord {
	stateMostRecent := []DailyRecord{}
	err := d.fetchObject(StateMostRecentAPI, MostRecentTTL, &stateMostRecent)
	if err != nil {
		log.Printf("%s: getUSStateMostRecent() failed: %+v\n", ERROR, err)
	}

	return stateMostRecent
}

// fetchStateDaily fetches state daily data from covidtracking.com API
func (d *Data) getUSMostRecent() DailyRecord {
	mostRecent := []DailyRecord{}
	if err := d.fetchObject(MostRecentAPI, MostRecentTTL, &mostRecent); err != nil {
		log.Printf("%s: getUSMostRecent() failed: %+v\n", ERROR, err)
	}
	if len(mostRecent) == 0 {
		log.Printf(
			"%s: getUSMostRecent() failed: %+v\n",
			ERROR,
			errors.New("fetchMostRecent(): unexpected data"))
		return DailyRecord{}
	}

	return mostRecent[0]
}

// fetchStateDaily fetches daily data from covidtracking.com API
func (d *Data) getUSDaily() []DailyRecord {
	daily := []DailyRecord{}
	if err := d.fetchObject(DailyAPI, DataTTL, &daily); err != nil {
		log.Printf("%s: getUSDaily() failed: %+v\n", ERROR, err)
	}

	return daily
}

// DailyPositiveNegativeTests gets positive negative tests
func (d *Data) DailyPositiveNegativeTests(
	daily []DailyRecord) []DailyPositiveNegativeTest {
	records := []DailyPositiveNegativeTest{}
	for _, record := range daily {
		records = append(records, DailyPositiveNegativeTest{
			Date:     record.Date.Time,
			Positive: record.Positive,
			Negative: record.Negative,
		})
	}

	return records
}

// DailyPositiveNegativeTests gets positive negative tests in US
func (d *Data) USDailyPositiveNegativeTests() []DailyPositiveNegativeTest {
	daily := d.getUSDaily()

	return d.DailyPositiveNegativeTests(daily)
}

// DailyPositiveNegativeTests gets positive negative tests in state
func (d *Data) StateDailyPositiveNegativeTests(
	state string) []DailyPositiveNegativeTest {
	stateDaily := d.getUSStateDaily()
	daily := d.getStateDaily(stateDaily, state)

	return d.DailyPositiveNegativeTests(daily)
}

// DailyPositive gets daily positive numbers in US
func (d *Data) DailyTotalAndNewPositive(
	fromRecords []DailyRecord) []DailyTotalAndNewPositive {
	dailyTotal := map[time.Time]int{}
	for _, record := range fromRecords {
		dailyTotal[record.Date.Time] = record.Positive
	}

	records := []DailyTotalAndNewPositive{}
	for _, record := range fromRecords {
		previousDayTotal, ok := dailyTotal[record.Date.Time.Add(-time.Hour*24)]
		if !ok {
			previousDayTotal = record.Positive
		}

		records = append(records, DailyTotalAndNewPositive{
			Date:          record.Date.Time,
			TotalPositive: record.Positive,
			NewPositive:   record.Positive - previousDayTotal,
		})
	}

	return records
}

// USDailyTotalAndNewPositive gets daily data in US
func (d *Data) USDailyTotalAndNewPositive() []DailyTotalAndNewPositive {
	daily := d.getUSDaily()

	return d.DailyTotalAndNewPositive(daily)
}

// getStateRecords get daily records by state
func (d *Data) getStateDaily(
	stateDaily []DailyRecord, state string) []DailyRecord {
	stateRecords := []DailyRecord{}
	for _, record := range stateDaily {
		if record.State == state {
			stateRecords = append(stateRecords, record)
		}
	}

	return stateRecords
}

// getStateMostRecent gets most recent data of state
func (d *Data) getStateMostRecent(
	stateMostRecent []DailyRecord,
	state string) DailyRecord {
	for _, record := range stateMostRecent {
		if record.State == state {
			return record
		}
	}

	return DailyRecord{
		State: state,
	}
}

// USDailyTotalAndNewPositive gets daily data in US
func (d *Data) StateDailyTotalAndNewPositive(
	state string) []DailyTotalAndNewPositive {
	stateDaily := d.getUSStateDaily()

	return d.DailyTotalAndNewPositive(
		d.getStateDaily(stateDaily, state))
}

// USMostRecent gets most recently data
func (d *Data) MostRecent(
	mostRecent DailyRecord,
	daily []DailyRecord) []DailyRecord {
	record := mostRecent

	// Compute diff
	currentDate := time.Now().In(d.westUSLocation)
	yesterday := currentDate.Add(-time.Hour * 24)

	var yesterdayRecord *DailyRecord = nil
	for _, record := range daily {
		if record.Date.Year() == yesterday.Year() &&
			record.Date.Month() == yesterday.Month() &&
			record.Date.Day() == yesterday.Day() {
			yesterdayRecord = &record
			break
		}
	}

	diffRecord := DailyRecord{}
	if yesterdayRecord != nil {
		diffRecord = DailyRecord{
			Date:     record.Date,
			Positive: record.Positive - yesterdayRecord.Positive,
			Negative: record.Negative - yesterdayRecord.Negative,
			PosNeg:   record.PosNeg - yesterdayRecord.PosNeg,
			Pending:  record.Pending - yesterdayRecord.Pending,
			Death:    record.Death - yesterdayRecord.Death,
			Total:    record.Total - yesterdayRecord.Total,
		}
	}

	return []DailyRecord{record, diffRecord}
}

// USMostRecent gets most recent data in US
func (d *Data) USMostRecent() []DailyRecord {
	daily := d.getUSDaily()
	mostRecent := d.getUSMostRecent()

	return d.MostRecent(mostRecent, daily)
}

// USMostRecent gets most recent data in State
func (d *Data) StateMostRecent(state string) []DailyRecord {
	daily := d.getUSStateDaily()
	mostRecent := d.getUSStateMostRecent()

	stateDaily := d.getStateDaily(daily, state)
	stateMostRecent := d.getStateMostRecent(mostRecent, state)

	return d.MostRecent(stateMostRecent, stateDaily)
}

// DailyPositiveAndNegative gets daily positive and negative number
func (d *Data) TotalPositiveAndNegative(
	daily []DailyRecord) []DailyPositiveNegativeTest {

	records := []DailyPositiveNegativeTest{}
	for _, record := range daily {
		records = append(records, DailyPositiveNegativeTest{
			Date:     record.Date.Time,
			Positive: record.Positive,
			Negative: record.Negative,
		})
	}

	return records
}

// USTotalPositiveAndNegative gets daily positive and negative number in US
func (d *Data) USTotalPositiveAndNegative() []DailyPositiveNegativeTest {
	daily := d.getUSDaily()

	return d.TotalPositiveAndNegative(daily)
}

// StateTotalPositiveAndNegative gets daily positive and negative number in state
func (d *Data) StateTotalPositiveAndNegative(
	state string) []DailyPositiveNegativeTest {
	daily := d.getUSStateDaily()

	stateDaily := d.getStateDaily(daily, state)

	return d.TotalPositiveAndNegative(stateDaily)
}

// DailyPositiveAndNegative gets daily positive and negative number
func (d *Data) DailyPositiveAndNegative(
	daily []DailyRecord) []DailyPositiveNegativeTest {
	dailyPositive := map[time.Time]int{}
	dailyNegative := map[time.Time]int{}
	for _, record := range daily {
		dailyPositive[record.Date.Time] = record.Positive
		dailyNegative[record.Date.Time] = record.Negative
	}

	records := []DailyPositiveNegativeTest{}
	for _, record := range daily {
		previousPositive, ok := dailyPositive[record.Date.Time.Add(-time.Hour*24)]
		if !ok {
			previousPositive = record.Positive
		}

		previousNegative, ok := dailyNegative[record.Date.Time.Add(-time.Hour*24)]
		if !ok {
			previousNegative = record.Negative
		}

		records = append(records, DailyPositiveNegativeTest{
			Date:     record.Date.Time,
			Positive: record.Positive - previousPositive,
			Negative: record.Negative - previousNegative,
		})
	}

	return records
}

// DailyPositiveAndNegative gets daily positive and negative number in US
func (d *Data) USDailyPositiveAndNegative() []DailyPositiveNegativeTest {
	daily := d.getUSDaily()
	return d.DailyPositiveAndNegative(daily)
}

// DailyPositiveAndNegative gets daily positive and negative number in state
func (d *Data) StateDailyPositiveAndNegative(
	state string) []DailyPositiveNegativeTest {
	daily := d.getUSStateDaily()

	stateDaily := d.getStateDaily(daily, state)
	return d.DailyPositiveAndNegative(stateDaily)
}

// Get most recent data of a states
func (d *Data) AllStateMostRecent() []RecordAndDiff {
	stateDaily := d.getUSStateDaily()
	stateMostRecent := d.getUSStateMostRecent()

	currentDate := time.Now().In(d.westUSLocation)
	yesterday := currentDate.Add(-time.Hour * 24)

	records := []RecordAndDiff{}
	for _, record := range stateMostRecent {
		diffRecord := DailyRecord{
			State: record.State,
		}
		for _, dailyRecord := range stateDaily {
			if record.State == dailyRecord.State &&
				yesterday.Year() == dailyRecord.Date.Year() &&
				yesterday.Month() == dailyRecord.Date.Month() &&
				yesterday.Day() == dailyRecord.Date.Day() {
				diffRecord = DailyRecord{
					State:    record.State,
					Positive: record.Positive - dailyRecord.Positive,
					Negative: record.Negative - dailyRecord.Negative,
					PosNeg:   record.PosNeg - dailyRecord.PosNeg,
					Pending:  record.Pending - dailyRecord.Pending,
					Death:    record.Death - dailyRecord.Death,
					Total:    record.Total - dailyRecord.Total,
				}
			}
		}
		records = append(records, RecordAndDiff{
			Record: record,
			Diff:   diffRecord,
		})
	}

	return records
}
