import {useState} from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { timeParse } from 'd3'
import styled from 'styled-components'
import { Base64 } from 'js-base64';

import { LineChart } from './LineChart';
import { NavBar } from './NavBar';
import { Breadcrumb } from './Breadcrumb';
import { MostRecentTable } from './MostRecentTable';
import { BarChart } from './BarChart';
import { Pagination } from './Pagination';
import { Colors } from './Colors';
import * as d3 from 'd3';
import { StateTable } from './StateTable';

declare const base64data: string;
const data = JSON.parse(Base64.decode(base64data));


const H4 = styled.h4`
  font-weight: normal;
  font-size: 18px;
  margin-top: 8px;
  margin-bottom: 4px; 
`

const A = styled.a`
  font-weight: bold;
  text-decoration: underline;
  color: #124b73;
  font-size: 12px;
`

const Footer = styled.div`
  margin-bottom: 24px;
`

const Page = () => {
  const [testPageA, setTestPageA] = useState<number>(0);
  const [testPageB, setTestPageB] = useState<number>(0);

  const confirmedTable = data.confirmed.map(
    (row: any) => [timeParse("%Y-%m-%dT%H:%M:%SZ")(row.date),
                   row.totalPositive,
                   row.newPositive]);
  const totalPosNegTable = data.totalPosNeg.map(
    (row: any) => [timeParse("%Y-%m-%dT%H:%M:%SZ")(row.date),
                   row.positive,
                   row.negative]);
  const dailyPosNegTable = data.dailyPosNeg.map(
    (row: any) => [timeParse("%Y-%m-%dT%H:%M:%SZ")(row.date),
                    row.positive,
                    row.negative]);
  const dailyPositiveRateTable = data.dailyPosNeg.map(
    (row: any) => [timeParse("%Y-%m-%dT%H:%M:%SZ")(row.date),
                    row.positive / (row.negative + row.positive)]);
  const totalPositiveRateTable = data.totalPosNeg.map(
    (row: any) => [timeParse("%Y-%m-%dT%H:%M:%SZ")(row.date),
                   row.positive / (row.negative + row.positive)]);

  return (
    <div>
      <NavBar />
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-12">
            <Breadcrumb pageType={data.pageType} />
            <H4>{data.pageType} - Most Recent Data</H4>
            <MostRecentTable data={data.mostRecently} />
            <H4>{data.pageType} - Confirmed Cases</H4>
            <LineChart schema={['Date', 'Total', 'New']}
                       rows={confirmedTable}
                       colors={Colors}
                       xFormatter={d3.timeFormat('%-m/%-d')}
                       yFormatter={d3.format(',.0f')}/>
            <H4>{data.pageType} - Tests</H4>
            <Pagination names={['Number', 'Positive Rate']} selectionIdx={testPageB} onSelect={setTestPageB} />
            { testPageB === 0 && (
              <BarChart schema={['Date', 'Total Positive', 'Total Negative']}
                        textColors={['#124b73', '#3fcbf9']}
                        colors={['#124b73', 'lightblue']}
                        rows={totalPosNegTable}
                        xFormatter={d3.timeFormat('%-m/%-d')}
                        yFormatter={d3.format(',.0f')} />
            )}
            { testPageB === 1 && (
              <LineChart schema={['Date', 'Total Positive Rate']}
                         shortSchema={['Date', 'Positive Rate']}
                         rows={totalPositiveRateTable}
                         colors={['orange']}
                         detailBoxPosition="bottom"
                         xFormatter={d3.timeFormat('%-m/%-d')}
                         yFormatter={d3.format(',.4p')} />
            )}
            {data.stateMostRecent && <H4>{data.pageType} - States</H4> }
            {data.stateMostRecent && <StateTable data={data.stateMostRecent} />}
            <H4>Data Source</H4>
            <Footer>
              <A href="https://covidtracking.com/">The COVID Tracking Project</A>
            </Footer>
          </div>
        </div>
      </div>
    </div>
  )
}

ReactDOM.render(
  <Page />,
  document.getElementById('main-container')
)

