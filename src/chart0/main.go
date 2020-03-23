package main

import (
	"encoding/base64"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
)

func getTemplate() *template.Template {
	tmplText := `
<!DOCTYPE html>
<html>

<head>
<meta charset="utf-8">
<title>COVID-19 Chart</title>
<meta name="author" content="">
<meta name="description" content="">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" type="text/css" href="/static/bootstrap-grid.min.css">
<link rel="stylesheet" type="text/css" href="/static/bootstrap.min.css">
<script>
  const base64data = "{{ . }}";
</script>
</head>

<body>
<div id="main-container"> Loading ... </div>
<script src="/static/bundle.js"></script>
</body>

</html>	
`
	t, err := template.New("foo").Parse(tmplText)
	if err != nil {
		log.Fatalln(err)
	}

	return t
}

func main() {
	dir, _ := os.Getwd()
	log.Println(dir)

	redisAddr := os.Getenv("REDIS_ADDR")
	redisPasswd := os.Getenv("REDIS_PASSWD")
	listenAddr := os.Getenv("LISTEN_ADDR")
	d := NewData(redisAddr, redisPasswd)
	pageTmpl := getTemplate()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		dataJson, _ := json.Marshal(map[string]interface{}{
			"confirmed":       d.USDailyTotalAndNewPositive(),
			"test":            d.USDailyPositiveNegativeTests(),
			"mostRecently":    d.USMostRecent(),
			"totalPosNeg":     d.USTotalPositiveAndNegative(),
			"dailyPosNeg":     d.USDailyPositiveAndNegative(),
			"stateMostRecent": d.AllStateMostRecent(),
			"pageType":        "US",
		})
		dataBase64 := base64.StdEncoding.EncodeToString(dataJson)

		if err := pageTmpl.Execute(w, dataBase64); err != nil {
			log.Printf("%s: execute template failed: %s\n", WARNING, err)
		}
	})

	http.HandleFunc("/state/", func(w http.ResponseWriter, r *http.Request) {
		state := strings.ToUpper(strings.TrimPrefix(r.URL.Path, "/state/"))

		dataJson, _ := json.Marshal(map[string]interface{}{
			"confirmed":    d.StateDailyTotalAndNewPositive(state),
			"test":         d.StateDailyPositiveNegativeTests(state),
			"mostRecently": d.StateMostRecent(state),
			"totalPosNeg":  d.StateTotalPositiveAndNegative(state),
			"dailyPosNeg":  d.StateDailyPositiveAndNegative(state),
			"pageType":     state,
		})
		dataBase64 := base64.StdEncoding.EncodeToString(dataJson)

		if err := pageTmpl.Execute(w, dataBase64); err != nil {
			log.Printf("%s: execute template failed: %s\n", WARNING, err)
		}
	})

	fs := http.FileServer(http.Dir("app/static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	log.Fatal(http.ListenAndServe(listenAddr, nil))
}
