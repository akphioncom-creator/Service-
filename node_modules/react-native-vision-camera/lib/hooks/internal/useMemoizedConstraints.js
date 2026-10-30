import { useRef } from 'react';
/**
 * Returns whether the given {@linkcode value} is a plain JS object
 * (i.e. an object literal like `{ fps: 60 }`), and not a class instance,
 * an `Array`, or a Nitro `HybridObject`.
 */
function isPlainObject(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
/**
 * Deep-compares two {@linkcode Constraint} values.
 *
 * Object literals (e.g. `{ fps: 60 }`, or a `TargetDynamicRange`) and
 * `Array`s are compared by value, everything else - most importantly the
 * {@linkcode CameraOutput} of a {@linkcode ResolutionBiasConstraint} - is
 * compared by identity.
 *
 * Nitro `HybridObject`s cannot be compared by value at all; they are created
 * via `Object.create(prototype)` and hold every property on their shared
 * prototype, so the actual JS object has no own keys (which is also why
 * `JSON.stringify(...)` serializes every `CameraOutput` to the exact same
 * string).
 */
function isEqual(left, right) {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right))
            return false;
        if (left.length !== right.length)
            return false;
        return left.every((item, index) => isEqual(item, right[index]));
    }
    if (!isPlainObject(left) || !isPlainObject(right))
        return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length)
        return false;
    return leftKeys.every((key) => key in right && isEqual(left[key], right[key]));
}
/**
 * Memoizes the given {@linkcode Constraint}s by value instead of by identity.
 *
 * {@linkcode Constraint}s are usually written as an inline array of object
 * literals (e.g. `constraints={[{ fps: 60 }]}`), which allocates a new array
 * and new objects on every render. Using those as a `useEffect` dependency
 * would re-configure the {@linkcode CameraSession} on every single render,
 * which renders again, and so on.
 */
export function useMemoizedConstraints(constraints) {
    const memoized = useRef(constraints);
    if (!isEqual(memoized.current, constraints)) {
        memoized.current = constraints;
    }
    return memoized.current;
}
