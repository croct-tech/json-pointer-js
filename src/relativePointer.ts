import type {JsonConvertible, JsonStructure} from '@croct/json';
import type {
    JsonPointerSegments,
    JsonPointerSegment,
    JsonPointerLike,
    Entry,
    ReferencedValue,
    RootValue,
} from './pointer';
import {JsonPointer, InvalidSyntaxError, JsonPointerError, InvalidReferenceError} from './pointer';

/**
 * A value that can be converted to a relative JSON pointer.
 */
export type JsonRelativePointerLike = JsonRelativePointer | number | string | JsonPointerSegments;

/**
 * A relative JSON pointer.
 *
 * @see https://datatracker.ietf.org/doc/html/draft-bhutton-relative-json-pointer-00
 */
export class JsonRelativePointer implements JsonConvertible {
    /**
     * The list of segments that form the pointer.
     */
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
     * JsonRelativePointer.from([1, 'bar']).join(JsonPointer.from(['baz']))
     * JsonRelativePointer.from(['1', 'bar', 'baz'])
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

    /**
     * Resolves relative pointer from an absolute pointer.
     *
     * @param {JsonPointerLike} pointer The base pointer.
     *
     * @returns {JsonPointer} The resolved pointer.
     *
     * @throws {JsonPointerError} If the pointer is out of bounds.
     * @throws {JsonPointerError} If the pointer is a key pointer.
     * @throws {JsonPointerError} If the pointer includes index offsets.
     */
    public resolve(pointer: JsonPointerLike): JsonPointer {
        if (this.isKeyPointer()) {
            throw new JsonPointerError('A key pointer cannot be resolved to an absolute pointer.');
        }

        if (this.getParentIndexOffset() !== 0) {
            throw new JsonPointerError('A pointer with an offset cannot be resolved to an absolute pointer.');
        }

        const parentIndex = this.getParentIndex();
        const base = JsonPointer.from(pointer);
        const segments = base.getSegments();

        if (parentIndex > segments.length) {
            throw new JsonPointerError('The relative pointer is out of bounds.');
        }

        return JsonPointer.from([
            ...(parentIndex > 0 ? segments.slice(0, -parentIndex) : segments),
            ...this.segments.slice(1),
        ]);
    }

    /**
     * Returns the value at the referenced location.
     *
     * @param {RootValue} root The value to read from.
     * @param {JsonPointer} pointer The base pointer to resolve the current pointer against.
     *
     * @returns {ReferencedValue|JsonPointerSegment} The value at the referenced location.
     *
     * @throws {InvalidReferenceError} If a numeric segment references a non-array value.
     * @throws {InvalidReferenceError} If a string segment references an array value.
     * @throws {InvalidReferenceError} If an array index is out of bounds.
     * @throws {InvalidReferenceError} If there is no value at any level of the pointer.
     * @throws {InvalidReferenceError} If the pointer references the key of the root value.
     */
    public get<T extends RootValue>(root: T, pointer = JsonPointer.root()): ReferencedValue<T> | JsonPointerSegment {
        const stack = this.getReferenceStack(root, pointer);
        const [segment, value] = stack[stack.length - 1];

        if (this.isKeyPointer()) {
            if (segment === null) {
                throw new InvalidReferenceError('The root value has no key.');
            }

            return segment;
        }

        // Given V = typeof value, and typeof value ⊆ ReferencedValue<T> → ReferencedValue<K> ⊆ ReferencedValue<T>
        return this.getRemainderPointer().get(value) as ReferencedValue<T>;
    }

    /**
     * Checks whether the value at the referenced location exists.
     *
     * This method gracefully handles missing values by returning `false`.
     *
     * @param {RootValue} root The value to check if the reference exists in.
     * @param {JsonPointer} pointer The base pointer to resolve the current pointer against.
     *
     * @returns {boolean} Returns `true` if the value exists, `false` otherwise.
     */
    public has(root: RootValue, pointer: JsonPointer = JsonPointer.root()): boolean {
        try {
            this.get(root, pointer);
        } catch {
            return false;
        }

        return true;
    }

    /**
     * Sets the value at the referenced location.
     *
     * @param {RootValue} root The value to write to.
     * @param {unknown} value The value to set at the referenced location.
     * @param {JsonPointer} pointer The base pointer to resolve the current pointer against.
     *
     * @throws {InvalidReferenceError} If the pointer references the root of the structure.
     * @throws {InvalidReferenceError} If a numeric segment references a non-array value.
     * @throws {InvalidReferenceError} If a string segment references an array value.
     * @throws {InvalidReferenceError} If there is no value at any level of the pointer.
     * @throws {InvalidReferenceError} If an array index is out of bounds.
     * @throws {InvalidReferenceError} If setting the value to an array would cause it to become
     * sparse.
     */
    public set(root: RootValue, value: unknown, pointer = JsonPointer.root()): void {
        if (this.isKeyPointer()) {
            throw new JsonPointerError('Cannot write to a key.');
        }

        const stack = this.getReferenceStack(root, pointer);
        const remainderPointer = this.getRemainderPointer();

        if (!remainderPointer.isRoot()) {
            remainderPointer.set(stack[stack.length - 1][1] as JsonStructure, value);

            return;
        }

        if (stack.length < 2) {
            throw new JsonPointerError('Cannot set the root value.');
        }

        const segment = stack[stack.length - 1][0]!;
        const structure = stack[stack.length - 2][1] as JsonStructure;

        JsonPointer.from([segment]).set(structure, value);
    }

    /**
     * Unsets the value at the referenced location and returns the unset value.
     *
     * If the given location does not exist, the method returns `undefined`, meaning the call
     * is a no-op. Pointers referencing array elements remove the element while keeping
     * the array dense.
     *
     * @param {RootValue} root The value to write to.
     * @param {JsonPointer} pointer The base pointer to resolve the current pointer against.
     *
     * @returns {JsonValue} The unset value, or `undefined` if the referenced location
     * does not exist.
     *
     * @throws {InvalidReferenceError} If the pointer references the root of the structure.
     */
    public unset<T extends RootValue>(root: T, pointer = JsonPointer.root()): ReferencedValue<T> | undefined {
        if (this.isKeyPointer()) {
            throw new JsonPointerError('Cannot write to a key.');
        }

        const stack = this.getReferenceStack(root, pointer);
        const remainderPointer = this.getRemainderPointer();

        if (!remainderPointer.isRoot()) {
            // Given V = typeof value, and typeof value ⊆ ReferencedValue<T> → ReferencedValue<K> ⊆ ReferencedValue<T>
            return remainderPointer.unset(stack[stack.length - 1][1]) as ReferencedValue<T>;
        }

        if (stack.length < 2) {
            throw new JsonPointerError('Cannot unset the root value.');
        }

        const segment = stack[stack.length - 1][0]!;
        const parent = stack[stack.length - 2][1];

        // Given V = typeof value, and typeof value ⊆ ReferencedValue<T> → ReferencedValue<K> ⊆ ReferencedValue<T>
        return JsonPointer.from([segment]).unset(parent) as ReferencedValue<T>;
    }

    /**
     * Returns the stack of references to the value at the referenced location.
     *
     * @param {RootValue} root The value to read from.
     * @param {JsonPointer} pointer The base pointer to resolve the current pointer against.
     *
     * @returns {Entry<ReferencedValue>[]} The list of entries in top-down order.
     *
     * @throws {InvalidReferenceError} If a numeric segment references a non-array value.
     * @throws {InvalidReferenceError} If a string segment references an array value.
     * @throws {InvalidReferenceError} If an array index is out of bounds.
     * @throws {InvalidReferenceError} If there is no value at any level of the pointer.
     */
    private getReferenceStack<T extends RootValue>(root: T, pointer: JsonPointer): Array<Entry<ReferencedValue<T>>> {
        const iterator = pointer.traverse(root);
        let current = iterator.next();
        const stack: Array<Entry<ReferencedValue<T>>> = [];

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
                throw new InvalidReferenceError('An offset can only be applied to array elements.');
            }

            const offsetIndex = entry[0] + offset;

            if (offsetIndex < 0 || offsetIndex >= elements.length) {
                throw new InvalidReferenceError('The element index is out of bounds.');
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
    public equals(other: any): other is JsonRelativePointer {
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
