import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components'
import { Colors } from './Colors';
import * as d3 from 'd3';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ChartSvg = styled.svg`
  font-family: sans-serif;
  font-size: 11px;
  user-select: none;
`

export const RelativeDiv = styled.div`
  position: relative;
`

export interface LeftAxisProps {
  yScale: d3.ScaleLinear<number, number>;
  width: number;
  formatter: (d: any) => string;
}
export const LeftAxis = (props: LeftAxisProps) => {
  const ticks = props.yScale.ticks(8);
  return (
    <g textAnchor="end">
      {ticks.map((tick, idx) => (
        <g key={idx} transform={`translate(0, ${props.yScale(tick)})`}>
          <text x="-9" dy="0.32em">{props.formatter(tick)}</text>
          {idx > 0 && (
            <line stroke="rgba(0, 0, 0, 0.2)" strokeDasharray="2,2" x2={props.width}></line>
          )}
        </g>
      ))}
    </g>
  )
}


export interface BottomAxisProps {
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  width: number;
  formatter: (d: any) => string;
}
export const BottomAxis = (props: BottomAxisProps) => {
  const y = props.yScale(props.yScale.ticks()[0]);
  const ticks = props.xScale.ticks(8);
  return (
    <g textAnchor="middle" transform={`translate(0, ${y})`} fill="none">
      <path stroke="rgba(0, 0, 0, 0.6)" d={`M0.5,6V0.5H${props.width - 0.5}V6`} />
      {ticks.map((tick, idx) => (
        <g key={idx} transform={`translate(${props.xScale(tick)}, 0)`}>
          <line stroke="rgba(0, 0, 0, 0.6)" y2="6"></line>
          <text fill="rgba(0, 0, 0, 0.6)" y="9" dy="0.71em">{props.formatter(tick)}</text>
        </g>
      ))}
    </g>
  )
}

export const relativeCoord = (
    event: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement, MouseEvent>,
    ref: Element) => {
  var bounds = ref.getBoundingClientRect();
  if ((event as React.TouchEvent<SVGSVGElement>).touches) {
    const touchEvent = event as React.TouchEvent<SVGSVGElement>;
    var x = touchEvent.touches[0].clientX - bounds.left;
    var y = touchEvent.touches[0].clientY - bounds.top;
  } else {
    const mouseEvent = event as React.MouseEvent<SVGSVGElement, MouseEvent>;
    var x = mouseEvent.clientX - bounds.left;
    var y = mouseEvent.clientY - bounds.top;
  }

  return [x, y];
}

const DetailDiv = styled.div`
  font-family: sans-serif;
  font-size: 11px;
  border: 2px solid rgba(0,0,0,0.6);
  padding: 5px;
  top: ${(props: any) => props.property === "top" ? "20px" : "140px"};
  left: 50px;
  position: absolute;
  background-color: white;
`;

export const guessDetailBoxPositiion = (
    y: d3.ScaleLinear<number, number>,
    rows: any[][]) => {
  var topCount = 0;
  var bottomCount = 0;
  var mid = (y.ticks(10)[0] + y.ticks(10)[y.ticks(10).length - 1]) / 2;
  rows.slice(0, Math.round(rows.length / 2)).forEach(row => {
    row.slice(1).forEach(d => {
      if (d > mid) {
        topCount += 1;
      } else {
        bottomCount += 1;
      }
    })
  })

  if (topCount > bottomCount) {
    return 'bottom';
  } else {
    return 'top';
  }
}

const LabelSpan = styled.span`
  color: ${(props: any) => props.color};
  font-weight: bolder;
  margin-right: 4px;
`;
export interface DetailsBoxProps {
  rows: any[][];
  schema: string[];
  selectedIdx: number;
  colors?: string[];
  position: string;
  formatter: (d: any) => string;
}
export const DetailBox = (props: DetailsBoxProps) => {
  return (
    <DetailDiv property={props.position}>
      <div><span>{d3.timeFormat("%-m/%-d")(props.rows[props.selectedIdx][0])}</span></div>
      {props.schema.slice(1).map((column, idx) => (
        <div key={idx}>
          <LabelSpan color={props.colors?.[idx] || Colors[idx]}>
            {column}
          </LabelSpan>
          <span>{props.formatter(props.rows[props.selectedIdx][idx + 1])}</span>
        </div>
      ))}
    </DetailDiv> 
  )
}

