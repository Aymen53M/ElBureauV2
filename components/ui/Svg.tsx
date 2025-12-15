import React from 'react';

type SvgProps = React.SVGProps<SVGSVGElement> & {
    width?: number | string;
    height?: number | string;
};

export default function Svg({ children, ...props }: SvgProps) {
    return <svg {...props}>{children}</svg>;
}

type CircleProps = React.SVGProps<SVGCircleElement> & {
    cx: number | string;
    cy: number | string;
    r: number | string;
};

export function Circle(props: CircleProps) {
    return <circle {...props} />;
}
