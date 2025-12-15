import React from 'react';
import { Link as RRLink, useLocation, useNavigate } from 'react-router-dom';

type Router = {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
};

export function useRouter(): Router {
    const navigate = useNavigate();

    return React.useMemo(() => {
        return {
            push: (href: string) => navigate(href),
            replace: (href: string) => navigate(href, { replace: true }),
            back: () => navigate(-1),
        };
    }, [navigate]);
}

export function usePathname(): string {
    const location = useLocation();
    return location.pathname;
}

type LinkProps = {
    href: string;
    asChild?: boolean;
    children: React.ReactNode;
};

export function Link({ href, asChild, children }: LinkProps) {
    const navigate = useNavigate();

    if (asChild && React.isValidElement(children)) {
        const child: any = children;
        const prevOnPress = child.props?.onPress;
        const prevOnClick = child.props?.onClick;

        const nextOnPress = (e: any) => {
            if (typeof prevOnPress === 'function') prevOnPress(e);
            navigate(href);
        };

        const nextOnClick = (e: any) => {
            if (typeof prevOnClick === 'function') prevOnClick(e);
            navigate(href);
        };

        return React.cloneElement(child, {
            onPress: nextOnPress,
            onClick: nextOnClick,
        });
    }

    return (
        <RRLink to={href}>
            {children as any}
        </RRLink>
    );
}
