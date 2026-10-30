import type { Constraint } from '../../specs/common-types/Constraint';
/**
 * Memoizes the given {@linkcode Constraint}s by value instead of by identity.
 *
 * {@linkcode Constraint}s are usually written as an inline array of object
 * literals (e.g. `constraints={[{ fps: 60 }]}`), which allocates a new array
 * and new objects on every render. Using those as a `useEffect` dependency
 * would re-configure the {@linkcode CameraSession} on every single render,
 * which renders again, and so on.
 */
export declare function useMemoizedConstraints(constraints: Constraint[]): Constraint[];
