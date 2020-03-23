import * as React from 'react';
import styled from 'styled-components'

const StyledOl = styled.ol`
  background-color: transparent;
  padding-left: 0;
  padding-bottom: 0;
  margin-bottom: 5px;
`

const A = styled.a`
  color: #124b73;
  text-decoration: underline;
`

interface BreadcrumbProps {
  pageType: string;
}
export const Breadcrumb = (props: BreadcrumbProps) => {
  return (
    <nav aria-label="breadcrumb">
      <StyledOl className="breadcrumb">
        <li className="breadcrumb-item"><A href="/">COVID-19 Charts</A></li>
        {props.pageType.toUpperCase() === 'US' ? (
          <li className="breadcrumb-item active" aria-current="page">US</li>
        ) : (
          <li className="breadcrumb-item active" aria-current="page">State</li>
        )}
        {props.pageType.toUpperCase() !== 'US' ? 
          <li className="breadcrumb-item active" aria-current="page">{props.pageType}</li> : null}
      </StyledOl>
    </nav>
  )
}
