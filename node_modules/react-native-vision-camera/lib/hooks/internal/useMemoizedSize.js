import { useMemo } from 'react';
export function useMemoizedSize(size) {
    const width = size?.width;
    const height = size?.height;
    return useMemo(() => {
        if (width == null || height == null)
            return undefined;
        return { width: width, height: height };
    }, [width, height]);
}
