import * as React from 'react';
import styled from 'styled-components'
import { format } from 'd3';

const TH = styled.th`
  color: #fff;
  background-color: #124b73 !important; 
  border-color: #124b73 !important; 
  text-align: center;
  font-size: 12px;
  padding: 2px !important;
`
const TD = styled.td`
  padding: .3rem;
  font-size: 12px;
  text-align: center;
  padding: 2px !important;
`

const GreenSpan = styled.span`
  font-size: 10px;
  color: green;
`

const RedSpan = styled.span`
  font-size: 10px;
  color: red;
`

const A = styled.a`
  font-weight: bold;
  text-decoration: underline;
  color: #124b73;
`

interface DiffSpanProp {
  value: number;
  good: boolean;
}
const DiffSpan = (props: DiffSpanProp) => {
  const valueText = format(',.0f')(Math.abs(props.value));
  const text = props.value >= 0 ? `+${valueText}` : `-${valueText}`;
  if (props.value === 0) {
    return null;
  }
  if ((props.good && (props.value > 0)) || (!props.good && (props.value < 0))) {
    return <GreenSpan>({text})</GreenSpan>
  } else {
    return <RedSpan>({text})</RedSpan>
  }
}

interface MostRecentRecord {
  state: string;
  positive: number;
  negative: number;
  pending: number;
  death: number;
  total: number;
  posNeg: number;
}
interface RecordAndDiff {
    record: MostRecentRecord;
    diff: MostRecentRecord;
}
interface StateTableProps {
  data: RecordAndDiff[];
}
export const StateTable = (props: StateTableProps) => {
  return (
    <table className="table table-sm">
      <thead className="thead-dark">
        <tr>
          <TH scope="col"></TH>
          <TH scope="col">Positive</TH>
          <TH scope="col">Negative</TH>
          <TH scope="col">Death</TH>
        </tr>
      </thead>
      <tbody>
        {props.data.filter(r => r.record.positive !== 0).map((recordDiff, idx) => (
          <tr key={idx}>
            <TD><A href={`/state/${recordDiff.record.state}`}>{recordDiff.record.state}</A></TD>
            <TD>{format(',.0f')(recordDiff.record.positive)}<DiffSpan good={false} value={recordDiff.diff.positive} /></TD>
            <TD>{format(',.0f')(recordDiff.record.negative)}<DiffSpan good={true} value={recordDiff.diff.negative} /></TD>
            <TD>{format(',.0f')(recordDiff.record.death)}<DiffSpan good={false} value={recordDiff.diff.death} /></TD>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
