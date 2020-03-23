import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components'
import { Colors } from './Colors';
import * as d3 from 'd3';
import { LeftAxis, BottomAxis, DetailBox, relativeCoord, Margin, ChartSvg, RelativeDiv, guessDetailBoxPositiion } from './ChartCommon';

const ContainerDiv = styled.div``

const SchemaDiv = styled.div`
  display: inline-flex;
  margin-left: 50px;
`

const SchemaColumnDiv = styled.div`
  display: flex;
  align-items: center;
  margin-right: 16px;
  font-family: sans-serif;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.7);
`

interface SchemaBoxProps {
  schema: string[];
  colors: string[];
}
const SchemaBox = (props: SchemaBoxProps) => {
  return (
    <SchemaDiv>
      {props.schema.slice(1).map((columnName, idx) => (
        <SchemaColumnDiv key={idx}>
          <svg width="35" height="16">
            <line x1="0" y1="8" x2="30" y2="8" stroke={props.colors[idx]} strokeWidth="2"></line>
            <circle r="4" fill="white" stroke={props.colors[idx]} strokeWidth="1.5" cx="15" cy="8"></circle>
          </svg>
          <span>{columnName}</span>
        </SchemaColumnDiv>
      ))}
   </SchemaDiv> 
  )
}

interface LineProps {
  rows: any[][];
  index: number;
  colors: string[];
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>;
}
const Line = (props: LineProps) => {
  const rows = props.rows.map(d => d);
  rows.sort((a, b) => a[0] - b[0]);
  
  var d = "";
  rows.forEach((row, idx) => {
    const value = row[props.index + 1];
    const key = row[0];

    if (isNaN(value)) {
      return;
    }

    const xOffset = props.xScale(key);
    const yOffset = props.yScale(value);

    if (d === "") {
      d += "M";
    } else {
      d += "L";
    }
  
    d += `${xOffset},${yOffset}`;
  });

  return (
    <g>
      <path fill="none" strokeWidth="2" stroke={props.colors[props.index]} d={d} />
      {rows.filter(row => !isNaN(row.slice(1).reduce((a, b) => a * b))).map((row, idx) => (
        <circle key={idx}
                r="4"
                fill="white"
                stroke={props.colors[props.index]}
                strokeWidth="1.5"
                cx={props.xScale(row[0])}
                cy={props.yScale(row[props.index + 1] || 0)} />
      ))}
    </g>
  )
}

interface ChartBoxProps {
  rows: any[][];
  xFormatter: (d: any) => string;
  yFormatter: (d: any) => string;
  width: number;
  height: number;
  colors: string[];
  margin: Margin;
  onSelect?: (idx: number) => void;
  selectionIdx?: number;
}
const ChartBox = (props: ChartBoxProps) => {
  const ref = useRef<SVGSVGElement>(null);

  const height = props.height - props.margin.top - props.margin.bottom;
  const width = props.width - props.margin.left - props.margin.right;

  const x = d3.scaleTime()
              .domain(d3.extent(props.rows, row => row[0]))
              .range([0, width]);
  const y = d3.scaleLinear()
              .domain([0, d3.max(props.rows, row => 1.2 * d3.max(row.slice(1), d => d))])
              .range([height, 0]);

  const onClick = useCallback((e: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    var [xOffset, _] = relativeCoord(e, ref.current);
    xOffset -= props.margin.left;
    
    // Find the row index nearest to x
    var nearestIdx = 0;
    var nearestDistance = 1e37;
    props.rows.forEach((row, idx) => {
      const distance = Math.abs(x(row[0]) - xOffset);
      if (distance < nearestDistance) {
        nearestIdx = idx;
        nearestDistance = distance;
      }
    });

    props.onSelect && props.onSelect(nearestIdx);
  }, [props.width, props.height]);

  const selectionX = props.selectionIdx !== null ? x(props.rows[props.selectionIdx][0]) : null;
  const selectionTop = y && y(y.ticks(8)[y.ticks(8).length - 1]);

  return (
    <ChartSvg width={props.width} height={props.height} onTouchMove={onClick} onMouseMove={onClick} ref={ref}>
      <g transform={`translate(${props.margin.left}, ${props.margin.top})`}>
        {selectionX != null && (
          <line x1={selectionX}
                y1={selectionTop}
                x2={selectionX}
                y2={y(0)}
                strokeWidth={1}
                stroke="rgba(0, 0, 0, 0.5)"
                fill="none" />
        )}
        <LeftAxis yScale={y} width={width} formatter={props.yFormatter} />
        <BottomAxis xScale={x} yScale={y} width={width} formatter={props.xFormatter} />
        {props.rows[0].slice(1).map((_, idx) => (
          <Line key={idx} rows={props.rows} index={idx} xScale={x} yScale={y} colors={props.colors} />
        ))}
      </g>
    </ChartSvg>
  )
}

interface LineChartProps {
  schema: string[];
  shortSchema?: string[];
  rows: any[][];
  colors: string[];
  detailBoxPosition?: string;
  textColors?: string[];
  xFormatter: (d: any) => string;
  yFormatter: (d: any) => string;
}
const ChartMargin: Margin = {
  top: 10,
  right: 10,
  bottom: 25,
  left: 50
}
export const LineChart = (props: LineChartProps) => {
  const [width, setWidth] = useState<number>(null);
  const [selection, setSelection] = useState<number>(null);
  const ref = useRef(null);

  const selectionCallback = useCallback((idx) => setSelection(idx), []);

  useEffect(() => {
    const width = ref.current?.offsetWidth 
    setWidth(width);
  }, [ref.current]);

  return (
    <ContainerDiv ref={ref}>
      <div>
        <RelativeDiv>
          <ChartBox rows={props.rows} 
                    width={width}
                    height={220}
                    margin={ChartMargin}
                    onSelect={selectionCallback}
                    colors={props.colors}
                    selectionIdx={selection}
                    xFormatter={props.xFormatter}
                    yFormatter={props.yFormatter}  />
          { selection != null && (
            <DetailBox rows={props.rows}
                       schema={props.shortSchema || props.schema}
                       selectedIdx={selection}
                       colors={props.textColors || props.colors} 
                       formatter={props.yFormatter}
                       position={props.detailBoxPosition || "top"} />
          )}
        </RelativeDiv>
        <SchemaBox schema={props.schema} colors={props.colors} />
      </div>
    </ContainerDiv>
  ) 
}
