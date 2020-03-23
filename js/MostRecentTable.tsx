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
  color: green;
`

const RedSpan = styled.span`
  color: red;
`

interface DiffSpanProp {
  value: number;
  good: boolean;
}
const DiffSpan = (props: DiffSpanProp) => {
  const valueText = format(',.0f')(Math.abs(props.value));
  const text = props.value >= 0 ? `+${valueText}` : `-${valueText}`;
  if ((props.good && (props.value > 0)) || (!props.good && (props.value < 0))) {
    return <GreenSpan>{text}</GreenSpan>
  } else {
    return <RedSpan>{text}</RedSpan>
  }
}

interface MostRecentRecord {
  positive: number;
  negative: number;
  pending: number;
  death: number;
  total: number;
  posNeg: number;
}
interface MostRecentTableProps {
  data: MostRecentRecord[];
}
export const MostRecentTable = (props: MostRecentTableProps) => {
  const current = props.data[0];
  const diff = props.data[1];

  return (
    <table className="table table-sm">
      <thead className="thead-dark">
        <tr>
          <TH scope="col">Positive</TH>
          <TH scope="col">Negative</TH>
          <TH scope="col">Death</TH>
          <TH scope="col">Tested</TH>
        </tr>
      </thead>
      <tbody>
        <tr>
          <TD>{format(',.0f')(current.positive)}<br />(<DiffSpan good={false} value={diff.positive} />)</TD>
          <TD>{format(',.0f')(current.negative)}<br />(<DiffSpan good={true} value={diff.negative} />)</TD>
          <TD>{format(',.0f')(current.death)}<br />(<DiffSpan good={false} value={diff.death} />)</TD>
          <TD>{format(',.0f')(current.posNeg)}<br />(<DiffSpan good={true} value={diff.posNeg} />)</TD>
        </tr>
      </tbody>
    </table>
  )
}
