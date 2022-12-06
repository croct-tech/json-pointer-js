import {JsonConvertible, JsonStructure, JsonValue} from '@croct/json';
import {
    JsonPointer,
    JsonPointerSegments,
    InvalidSyntaxError,
    JsonPointerSegment,
    JsonPointerError,
    JsonPointerLike,
    Entry,
} from './pointer';

export type JsonRelativePointerLike = JsonRelativePointer | number | string | JsonPointerSegments;

/**
 * A relative JSON pointer.
 *
 * @see https://datatracker.ietf.org/doc/html/draft-bhutton-relative-json-pointer-00
 */
export class JsonRelativePointer implements JsonConvertible {
    private readonly segments: JsonPointerSegments;

    private constructor(segments: JsonPointerSegments) {
        this.segments = segments;
    }

    /**
     * Creates a pointer from any valid pointer-like value.
     *
     * The return is as follows:
     *
     * - Pointers are returned as given
     * - Numbers are used as the number of parent levels
     * - Arrays are assumed to be unescaped segments
     * - Strings are delegated to `JsonRelativePointer.parse` and the result is returned
     *
     * @param path A pointer-like value.
     *
     * @returns The normalized pointer for the given value.
     *
     * @see JsonRelativePointer.parse
     */
    public static from(path: JsonRelativePointerLike): JsonRelativePointer {
        if (path instanceof JsonRelativePointer) {
            return path;
        }

        if (Array.isArray(path)) {
            if (path.length > 0 && !/^\d+([+-]\d+)?#?$/.test(path[0].toString())) {
                throw new InvalidSyntaxError(
                    'A relative JSON pointer must start with a non-negative '
                    + 'integer optionally followed by a hash character.',
                );
            }

            return JsonRelativePointer.fromSegments(path);
        }

        if (typeof path === 'number') {
            return JsonRelativePointer.fromSegments([path]);
        }

        return JsonRelativePointer.parse(path);
    }

    /**
     * Creates a pointer from a list of unescaped segments.
     *
     * Numeric segments must be safe non-negative integers.
     *
     * @param {JsonPointerSegments} segments A list of unescaped segments.
     *
     * @returns {JsonPointer} The pointer to the value at the path specified by the segments.
     *
     * @throws {InvalidSyntaxError} If the segments are not valid.
     */
    private static fromSegments(segments: JsonPointerSegment[]): JsonRelativePointer {
        if (segments.length === 0) {
            throw new InvalidSyntaxError('A relative pointer must have at least one segment.');
        }

        return new JsonRelativePointer(JsonPointer.from(segments).getSegments());
    }

    /**
     * Parses a string into a pointer. The string is split on the dot character and
     * segments composed solely of numbers are parsed as integers.
     *
     * @param {string} path The string representation of a pointer.
     *
     * @returns {JsonPointer} The pointer to the value at the specified path.
     *
     * @throws {InvalidSyntaxError} If the path is not a valid JSON Pointer.
     */
    public static parse(path: string): JsonRelativePointer {
        if (!/^\d+([+-]\d+)?#?(\/|$)/.test(path)) {
            throw new InvalidSyntaxError(
                'A relative JSON pointer must start with a non-negative '
                + 'integer optionally followed by a hash character.',
            );
        }

        return JsonRelativePointer.fromSegments(JsonPointer.parse(`/${path}`).getSegments());
    }

    /**
     * Checks whether the pointer references a key (array index or object property).
     *
     * @returns {boolean} Whether the pointer references key.
     */
    public isKeyPointer(): boolean {
        return `${this.segments[0]}`.endsWith('#');
    }

    /**
     * Returns the number of levels up from the initial location.
     *
     * @returns {number} The number of levels up from the initial location.
     */
    public getParentIndex(): number {
        return Number.parseInt(`${this.segments[0]}`, 10);
    }

    /**
     * Returns the index offset of the pointer.
     *
     * @returns {number} A signed integer representing the offset of the pointer.
     */
    public getParentIndexOffset(): number {
        const match = /([+-]\d+)#?$/.exec((`${this.segments[0]}`));

        if (match === null) {
            return 0;
        }

        return Number.parseInt(match[1], 10);
    }

    /**
     * Returns a pointer to the parent of the current pointer.
     *
     * @returns {JsonPointer} The parent pointer.
     */
    public getParent(): JsonRelativePointer {
        if (this.segments.length < 2) {
            throw new JsonPointerError('Cannot get the parent of a unresolved segment.');
        }

        return new JsonRelativePointer(this.segments.slice(0, -1));
    }

    /**
     * Returns a pointer that represents the remainder of the path after the first segment.
     *
     * For example, if the current pointer is `0/foo/bar/baz` calling this method returns
     * a pointer to `/foo/bar/baz`.
     *
     * @returns {JsonPointer} A pointer to the remainder of the path.
     */
    public getRemainderPointer(): JsonPointer {
        return JsonPointer.from(this.segments.slice(1));
    }

    /**
     * Returns the segments of the pointer.
     *
     * @returns {JsonPointerSegments} The segments of the pointer.
     */
    public getSegments(): JsonPointerSegments {
        return [...this.segments];
    }

    /**
     * Joins this pointer with another one and returns the result.
     *
     * The segments of the second pointer are appended to the segments of the first.
     *
     * These are equivalent:
     *
     * ```js
     * Pointer.from(['foo', 'bar']).join(Pointer.from(['baz']))
     * Pointer.from(['foo', 'bar', 'baz'])
     * ```
     *
     * @param {JsonPointer} other The pointer to append to this one.
     *
     * @returns {JsonPointer} A pointer with the segments of this and the other pointer joined.
     */
    public joinedWith(other: JsonPointerLike): JsonRelativePointer {
        if (this.isKeyPointer()) {
            throw new JsonPointerError('Cannot join a key pointer.');
        }

        const normalizedPointer = JsonPointer.from(other);

        if (normalizedPointer.isRoot()) {
            return this;
        }

        return JsonRelativePointer.fromSegments(
            this.segments.concat(normalizedPointer.getSegments()),
        );
    }

    public get(root: JsonValue, pointer: JsonPointer = JsonPointer.root()): JsonValue {
        const stack = this.getReferenceStack(root, pointer);
        const [segment, value] = stack[stack.length - 1];

        if (this.isKeyPointer()) {
            if (segment === null) {
                throw new JsonPointerError('The root value has no key.');
            }

            return segment;
        }

        return this.getRemainderPointer().get(value);
    }

    public has(root: JsonValue, pointer: JsonPointer = JsonPointer.root()): boolean {
        try {
            this.get(root, pointer);
        } catch {
            return false;
        }

        return true;
    }

    public set(root: JsonValue, value: JsonValue, pointer: JsonPointer = JsonPointer.root()): void {
        if (this.isKeyPointer()) {
            throw new JsonPointerError('Cannot write to a key.');
        }

        const stack = this.getReferenceStack(root, pointer);

        if (stack.length < 2) {
            throw new JsonPointerError('Cannot set the root value.');
        }

        const remainderPointer = this.getRemainderPointer();

        if (!remainderPointer.isRoot()) {
            remainderPointer.set(stack[stack.length - 1][1] as JsonStructure, value);

            return;
        }

        const segment = stack[stack.length - 1][0]!;
        const structure = stack[stack.length - 2][1] as JsonStructure;

        JsonPointer.from([segment]).set(structure, value);
    }

    public unset(root: JsonValue, pointer: JsonPointer = JsonPointer.root()): void {
        if (this.isKeyPointer()) {
            throw new JsonPointerError('Cannot write to a key pointer.');
        }

        const stack = this.getReferenceStack(root, pointer);

        if (stack.length < 2) {
            throw new JsonPointerError('Cannot unset the root value.');
        }

        const remainderPointer = this.getRemainderPointer();

        if (!remainderPointer.isRoot()) {
            remainderPointer.unset(stack[stack.length - 1][1] as JsonStructure);

            return;
        }

        const segment = stack[stack.length - 1][0]!;
        const structure = stack[stack.length - 2][1] as JsonStructure;

        JsonPointer.from([segment]).unset(structure);
    }

    private getReferenceStack(root: JsonValue, pointer: JsonPointer = JsonPointer.root()): Entry[] {
        const iterator = pointer.traverse(root);
        let current = iterator.next();
        const stack: Entry[] = [];

        while (current.done === false) {
            stack.push(current.value);

            const next = iterator.next();

            if (next.done === true) {
                break;
            }

            current = next;
        }

        const parentIndex = this.getParentIndex();

        if (parentIndex >= stack.length) {
            throw new JsonPointerError('The relative pointer is out of bounds.');
        }

        const stackIndex = stack.length - parentIndex - 1;
        const offset = this.getParentIndexOffset();

        if (offset !== 0) {
            const entry = stack[stackIndex];
            const elements = stack[stackIndex - 1]?.[1];

            if (!Array.isArray(elements) || typeof entry[0] !== 'number') {
                throw new JsonPointerError('An offset can only be applied to array elements.');
            }

            const offsetIndex = entry[0] + offset;

            if (offsetIndex < 0 || offsetIndex >= elements.length) {
                throw new JsonPointerError('The element index is out of bounds.');
            }

            return [
                ...stack.slice(0, stackIndex),
                [offsetIndex, elements[offsetIndex]],
            ];
        }

        return stack.slice(0, stackIndex + 1);
    }

    /**
     * Checks whether the pointer is logically equivalent to another pointer.
     *
     * @param {any} other The pointer to check for equality.
     *
     * @returns {boolean} `true` if the pointers are logically equal, `false` otherwise.
     */
    public equals(other: any): other is this {
        if (this === other) {
            return true;
        }

        if (!(other instanceof JsonRelativePointer)) {
            return false;
        }

        if (this.segments.length !== other.segments.length) {
            return false;
        }

        for (let i = 0; i < this.segments.length; i++) {
            if (this.segments[i] !== other.segments[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns the string representation of the pointer.
     *
     * @returns {string} The string representation of the pointer
     */
    public toJSON(): string {
        return this.toString();
    }

    /**
     * Returns the string representation of the pointer.
     *
     * @returns {string} The string representation of the pointer
     */
    public toString(): string {
        const parentSegment = this.segments[0].toString();
        const remainingSegments = JsonPointer.from(this.segments.slice(1));

        return `${parentSegment}${remainingSegments}`;
    }
}
