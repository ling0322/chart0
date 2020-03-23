import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components'
import { Colors } from './Colors';
import * as d3 from 'd3';
import { Margin, ChartSvg, LeftAxis, BottomAxis, RelativeDiv, relativeCoord, DetailBox } from './ChartCommon';

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
          <svg width="16" height="16">
            <rect x="2" y="2" width="12" height="12" fill={props.colors[idx]} stroke={props.colors[idx]}  />
          </svg>
          <span>{columnName}</span>
        </SchemaColumnDiv>
      ))}
   </SchemaDiv> 
  )
}

interface BarProps {
  rows: any[][];
  colors: string[];
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  barWidth: number;
}
const Bar = (props: BarProps) => {
  const rows = props.rows.map(d => d);
  rows.sort((a, b) => a[0] - b[0]);
  
  return (
    <g>
      {rows.map((row, rowIdx) => {
        var sum = 0;
        const x0 = props.xScale(row[0]) - (props.barWidth / 2);

        return (
          <g key={rowIdx}>
            {row.slice(1).map((value, idx) => {
              const height = props.yScale(0) - props.yScale(value);
              const y0 = props.yScale(sum + value);

              sum += value;
              return <rect fill={props.colors[idx]}
                          x={Math.max(x0, 0)}
                          y={Math.max(y0, 0)}
                          width={Math.max(props.barWidth, 0)}
                          height={Math.max(height, 0)}
                          key={idx} />
            })}
          </g>)
        })}
    </g>
  )
}

interface ChartBoxProps {
  rows: any[][];
  width: number;
  height: number;
  margin: Margin;
  colors: string[];
  onSelect?: (idx: number) => void;
  selectionIdx?: number;
  xFormatter: (d: any) => string;
  yFormatter: (d: any) => string;
}
const ChartBox = (props: ChartBoxProps) => {
  const ref = useRef<SVGSVGElement>(null);

  const height = props.height - props.margin.top - props.margin.bottom;
  const width = props.width - props.margin.left - props.margin.right;

  // n * barWidth + (n - 1) * marginWidth = width
  // marginWidth = r * barWidth
  // n * barWidth + (n - 1) * r * barWidth = width
  // barWidth = width / (n + n * r - r)
  const n = props.rows.length;
  const r = 0.7;
  const barWidth = width / (n + n * r - r);

  const x = d3.scaleTime()
              .domain(d3.extent(props.rows, row => row[0]))
              .range([barWidth / 2, width - barWidth / 2]);
  const y = d3.scaleLinear()
              .domain([0, d3.max(props.rows, row => 1.1 * row.slice(1).reduce((a, b) => a + b, 0))])
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
    <ChartSvg width={props.width} height={props.height} onMouseMove={onClick} onTouchMove={onClick} ref={ref}>
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
        <Bar rows={props.rows} colors={props.colors} xScale={x} yScale={y} barWidth={barWidth} />
      </g>
    </ChartSvg>
  )
}

interface BarChartProps {
  schema: string[];
  rows: any[][];
  colors: string[];
  textColors?: string[];
  detailBoxPosition?: string;
  xFormatter: (d: any) => string;
  yFormatter: (d: any) => string;
}
const ChartMargin: Margin = {
  top: 5,
  right: 10,
  bottom: 25,
  left: 50
}
export const BarChart = (props: BarChartProps) => {
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
                    selectionIdx={selection}
                    colors={props.colors}
                    xFormatter={props.xFormatter}
                    yFormatter={props.yFormatter}  />
          { selection != null && (
            <DetailBox rows={props.rows} 
                       schema={props.schema}
                       selectedIdx={selection} 
                       colors={props.textColors || props.colors}
                       formatter={props.yFormatter}
                       position={props.detailBoxPosition || 'top'} />
          )}
        </RelativeDiv>
        <SchemaBox schema={props.schema} colors={props.colors} />
      </div>
    </ContainerDiv>
  ) 
}

