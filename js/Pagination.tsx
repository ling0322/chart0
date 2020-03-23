import * as React from 'react';
import styled from 'styled-components'

const Ul = styled.ul`
  margin-bottom: 0;

  li span {
    color: #124b73;
    border-color: #124b73;
    cursor: pointer;
  }

  li span:hover {
    color: #124b73;
    border-color: #124b73;
    background-color: white;
  }

  li.active span {
    background-color: #124b73 !important;
    border-color: #124b73 !important;
  }
`

const Nav = styled.nav`
  display: inline-block;
  margin-right: 5px;
`


interface PaginationProps {
  names: string[];
  selectionIdx: number; 
  onSelect: (idx: number) => void;
}
export const Pagination = (props: PaginationProps) => {
  return (
    <Nav>
      <Ul className="pagination pagination-sm">
        {props.names.map((name, idx) => props.selectionIdx === idx ? (
            <li key={idx} className="page-item active">
              <span className="page-link">{name}</span>
            </li>
          ) : (
            <li key={idx} className="page-item" onClick={() => props.onSelect(idx)}>
              <span className="page-link">{name}</span>
            </li>
          ))}
      </Ul>
    </Nav>
  )
}
