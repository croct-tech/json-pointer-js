import {JsonConvertible, JsonStructure, JsonValue} from '@croct/json';

export type JsonPointerLike = JsonPointer | number | string | JsonPointerSegments;

export type JsonPointerSegment = string | number;

export type JsonPointerSegments = JsonPointerSegment[];

/**
 * An error indicating a problem related to JSON pointer operations.
 */
export class JsonPointerError extends Error {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, JsonPointerError.prototype);
    }
}

/**
 * An error indicating a problem related to malformed JSON pointers.
 */
export class InvalidSyntaxError extends JsonPointerError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, InvalidSyntaxError.prototype);
    }
}

/**
 * An error indicating an invalid reference for a given structure.
 */
export class InvalidReferenceError extends JsonPointerError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, InvalidReferenceError.prototype);
    }
}

/**
 * An RFC 6901-compliant JSON pointer.
 *
 * @see https://tools.ietf.org/html/rfc6901
 */
export class JsonPointer implements JsonConvertible {
    private static readonly ROOT_SINGLETON = new JsonPointer([]);

    private readonly segments: JsonPointerSegments;

    private constructor(segments: JsonPointerSegments) {
        this.segments = segments;
    }

    /**
     * Returns a pointer referencing the root of the JSON object.
     *
     * Root pointers cannot be used to modify values.
     *
     * @returns A pointer referencing the root of the JSON object.
     */
    public static root(): JsonPointer {
        return JsonPointer.ROOT_SINGLETON;
    }

    /**
     * Creates a pointer from any valid pointer-like value.
     *
     * The return is as follows:
     *
     * - Pointers are returned as given
     * - Numbers are used as single segments
     * - Arrays are assumed to be unescaped segments
     * - Strings are delegated to `Pointer.parse` and the result is returned
     *
     * @param path A pointer-like value.
     *
     * @returns The normalized pointer for the given value.
     *
     * @see JsonPointer.parse
     */
    public static from(path: JsonPointerLike): JsonPointer {
        if (path instanceof JsonPointer) {
            return path;
        }

        if (Array.isArray(path)) {
            return JsonPointer.fromSegments(path);
        }

        if (typeof path === 'number') {
            return JsonPointer.fromSegments([path]);
        }

        return JsonPointer.parse(path);
    }

    /**
     * Creates a pointer from a list of unescaped segments.
     *
     * Numeric segments must be finite non-negative integers.
     *
     * @param {JsonPointerSegments} segments A list of unescaped segments.
     *
     * @returns {JsonPointer} The pointer to the value at the path specified by the segments.
     *
     * @throws {InvalidSyntaxError} If the segments are not valid.
     */
    private static fromSegments(segments: JsonPointerSegment[]): JsonPointer {
        for (const segment of segments) {
            if (typeof segment === 'number' && (segment < 0 || !Number.isSafeInteger(segment))) {
                throw new InvalidSyntaxError(`Invalid integer segment "${segment}".`);
            }
        }

        return new JsonPointer(segments);
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
    public static parse(path: string): JsonPointer {
        if (path.length === 0) {
            return JsonPointer.root();
        }

        if (/~(?![0-1])/.test(path)) {
            throw new InvalidSyntaxError(`Invalid escape sequence in "${path}".`);
        }

        if (path.charAt(0) !== '/') {
            throw new InvalidSyntaxError(
                `A non-root pointer must start with a slash, actual "${path}".`,
            );
        }

        return new JsonPointer(path.substring(1).split('/').map(JsonPointer.unescapeSegment));
    }

    /**
     * Checks whether the reference points to an array element.
     *
     * @returns {boolean} Whether the pointer is an array index.
     */
    public isIndex(): boolean {
        return typeof this.segments[this.segments.length - 1] === 'number';
    }

    /**
     * Returns the depth of the pointer.
     *
     * The depth of a pointer is the number nesting from the root it contains.
     *
     * @example
     * // returns 2
     * Pointer.from('/foo/bar').depth()
     *
     * @returns {number} The depth of the pointer.
     */
    public getDepth(): number {
        return this.segments.length;
    }

    /**
     * Returns if the pointer is the root pointer.
     *
     * @returns {boolean}
     */
    public isRoot(): boolean {
        return this.segments.length === 0;
    }

    /**
     * Returns a pointer to the parent of the current pointer.
     *
     * @returns {JsonPointer} The parent pointer.
     */
    public getParent(): JsonPointer {
        if (this.segments.length === 0) {
            throw new JsonPointerError('Cannot get parent of root pointer.');
        }

        return new JsonPointer(this.segments.slice(0, -1));
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
     * Returns a pointer truncated to the given depth.
     *
     * @param depth The depth of the pointer, where 0 represents the root
     */
    public truncatedAt(depth: number): JsonPointer {
        if (depth === 0) {
            return JsonPointer.root();
        }

        if (depth < 0 || depth > this.segments.length) {
            throw new JsonPointerError(`Depth ${depth} is out of bounds.`);
        }

        return new JsonPointer(this.segments.slice(0, depth));
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
    public joinedWith(other: JsonPointerLike): JsonPointer {
        const normalizedPointer = JsonPointer.from(other);

        if (normalizedPointer.isRoot()) {
            return this;
        }

        return JsonPointer.fromSegments(this.segments.concat(normalizedPointer.segments));
    }

    /**
     * Returns the value at the referenced location.
     *
     * @param {JsonStructure} structure The structure to get the value from.
     *
     * @returns {JsonValue} The value at the referenced location.
     *
     * @throws {InvalidReferenceError} If a numeric segment references a non-array value.
     * @throws {InvalidReferenceError} If a string segment references an array value.
     * @throws {InvalidReferenceError} If there is no value at any level of the pointer.
     */
    public get(structure: JsonStructure): JsonValue {
        let current: JsonValue = structure;

        for (let i = 0; i < this.segments.length; i++) {
            if (typeof current !== 'object' || current === null) {
                throw new InvalidReferenceError(`Cannot read value at "${this.truncatedAt(i)}".`);
            }

            const segment = this.segments[i];

            if (Array.isArray(current)) {
                if (segment === '-') {
                    throw new InvalidReferenceError(
                        `Index ${current.length} is out of bounds at "${this.truncatedAt(i)}".`,
                    );
                }

                if (typeof segment !== 'number') {
                    throw new InvalidReferenceError(
                        `Expected an object at "${this.truncatedAt(i)}", got an array.`,
                    );
                }

                if (segment >= current.length) {
                    throw new InvalidReferenceError(
                        `Index ${segment} is out of bounds at "${this.truncatedAt(i)}".`,
                    );
                }

                current = current[segment];

                continue;
            }

            if (typeof segment === 'number') {
                throw new InvalidReferenceError(
                    `Expected array at "${this.truncatedAt(i)}", got object.`,
                );
            }

            if (!(segment in current)) {
                throw new InvalidReferenceError(
                    `Property "${segment}" does not exist at "${this.truncatedAt(i)}".`,
                );
            }

            current = current[segment];
        }

        return current;
    }

    /**
     * Checks whether the value at the referenced location exists.
     *
     * This method gracefully handles missing values by returning `false`.
     *
     * @param {JsonStructure} structure The structure to check if the value exists.
     *
     * @returns {JsonValue} Returns `true` if the value exists, `false` otherwise.
     */
    public has(structure: JsonStructure): boolean {
        try {
            this.get(structure);
        } catch {
            return false;
        }

        return true;
    }

    /**
     * Sets the value at the referenced location.
     *
     * @param {JsonStructure} structure The structure to set the value at the referenced location.
     * @param {JsonValue} value The value to set.
     *
     * @throws {InvalidReferenceError} If the pointer references the root of the structure.
     * @throws {InvalidReferenceError} If a numeric segment references a non-array value.
     * @throws {InvalidReferenceError} If a string segment references an array value.
     * @throws {InvalidReferenceError} If there is no value at any level of the pointer.
     * @throws {InvalidReferenceError} If setting the value to an array would cause it to become
     * sparse.
     */
    public set(structure: JsonStructure, value: JsonValue): void {
        if (this.isRoot()) {
            throw new JsonPointerError('Cannot set root value.');
        }

        const parent = this.getParent().get(structure);

        if (typeof parent !== 'object' || parent === null) {
            throw new JsonPointerError(`Cannot set value at "${this.getParent()}".`);
        }

        const segmentIndex = this.segments.length - 1;
        const segment = this.segments[segmentIndex];

        if (typeof segment === 'number' || segment === '-') {
            if (!Array.isArray(parent)) {
                throw new Error(`Expected array at "${this.getParent()}", got object.`);
            }

            if (segment === '-') {
                parent.push(value);

                return;
            }

            if (segment > parent.length) {
                throw new InvalidReferenceError(
                    `Index ${segment} is out of bounds at "${this.getParent()}".`,
                );
            }

            parent[segment] = value;

            return;
        }

        if (Array.isArray(parent)) {
            throw new Error(`Expected an object at "${this.getParent()}", got an array.`);
        }

        parent[segment] = value;
    }

    /**
     * Unsets the value at the referenced location and returns the unset value.
     *
     * If the given location does not exist, the method returns `undefined`, meaning the call
     * is a no-op. Pointers referencing array elements remove the element while keeping
     * the array dense.
     *
     * @param {JsonStructure} structure The structure to unset the value at the referenced location.
     *
     * @returns {JsonValue} The unset value, or `undefined` if the referenced location
     * does not exist.
     *
     * @throws {InvalidReferenceError} If the pointer references the root of the structure.
     */
    public unset(structure: JsonStructure): JsonValue | undefined {
        if (this.isRoot()) {
            throw new InvalidReferenceError('Cannot unset the root value.');
        }

        let parent: JsonValue;

        try {
            parent = this.getParent().get(structure);
        } catch {
            return undefined;
        }

        if (typeof parent !== 'object' || parent === null) {
            return undefined;
        }

        const segmentIndex = this.segments.length - 1;
        const segment = this.segments[segmentIndex];

        if (typeof segment === 'number') {
            if (!Array.isArray(parent) || segment >= parent.length) {
                return undefined;
            }

            const value = parent[segment];

            parent.splice(segment, 1);

            return value;
        }

        if (Array.isArray(parent) || !(segment in parent)) {
            return undefined;
        }

        const value = parent[segment];

        delete parent[segment];

        return value;
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

        if (!(other instanceof JsonPointer)) {
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
        if (this.isRoot()) {
            return '';
        }

        return `/${this.segments.map(JsonPointer.escapeSegment).join('/')}`;
    }

    /**
     * Converts a segment to its normalized form.
     *
     * @param segment The escaped segment to convert into its normalized form.
     */
    private static unescapeSegment(segment: string): JsonPointerSegment {
        if (/^\d+$/.test(segment)) {
            return parseInt(segment, 10);
        }

        /*
         * First transform any occurrence of the sequence '~1' to '/', and then
         * transform any occurrence of the sequence '~0' to '~', avoiding
         * the error of turning '~01' first into '~1' and then into '/',
         * which would be incorrect (the string '~01' correctly becomes '~1'
         * after transformation).
         */
        return segment.replace(/~1/g, '/')
            .replace(/~0/g, '~');
    }

    /**
     * Converts a segment to its normalized form.
     *
     * @param segment The escaped segment to convert into its normalized form.
     */
    private static escapeSegment(segment: JsonPointerSegment): string {
        if (typeof segment === 'number') {
            return `${segment}`;
        }

        /**
         * First transform any occurrence of '~' to '~0', and then transform any
         * occurrence of '/' to '~1' to avoid the error of turning '/' first into
         * '~1' and then into '~01', which would be incorrect (the string '/'
         * correctly becomes '~1' after transformation)
         */
        return segment.replace('~', '~0')
            .replace('/', '~1');
    }
}
