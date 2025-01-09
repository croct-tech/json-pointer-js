import {JsonValue} from '@croct/json';
import {
    InvalidReferenceError,
    InvalidSyntaxError,
    JsonPointer,
    JsonPointerError,
    JsonPointerLike,
    JsonPointerSegments,
    RootValue,
} from '../src';
import {JsonRelativePointer, JsonRelativePointerLike} from '../src/relativePointer';

describe('A JSON Relative Pointer', () => {
    it.each(
        [
            ['0#', '0#'],
            ['0+1', '0+1'],
            ['0-1', '0-1'],
            ['0-1/foo', '0-1/foo'],
            [['0-1', 'foo'], '0-1/foo'],
            ['0/foo', '0/foo'],
            ['0/foo/bar', '0/foo/bar'],
            ['0/foo/-', '0/foo/-'],
            ['0/foo/1', '0/foo/1'],
            [['0'], '0'],
            [['0', 'foo', 'bar'], '0/foo/bar'],
            [['0', 'foo', 1], '0/foo/1'],
            [['0', 'foo', '-'], '0/foo/-'],
            [0, '0'],
            [Number.MAX_SAFE_INTEGER, `${Number.MAX_SAFE_INTEGER}`],
            [JsonRelativePointer.parse('0/foo/bar'), '0/foo/bar'],
        ],
    )('should convert "%s" into "%s"', (pointer: JsonRelativePointerLike, expected: string) => {
        expect(JsonRelativePointer.from(pointer))
            .toStrictEqual(JsonRelativePointer.parse(expected));
    });

    it.each(
        [
            [[-1]],
            [[1.5]],
            [[Number.NaN]],
            [[Number.MAX_VALUE]],
            [[Number.MIN_VALUE]],
            [[Number.POSITIVE_INFINITY]],
            [[Number.NEGATIVE_INFINITY]],
            [['foo']],
            [['#']],
            [['1a']],
            ['1a'],
        ],
    )(
        'should fail to convert "%s" because it does not start with a valid relative segment',
        (pointer: JsonRelativePointerLike) => {
            expect(() => JsonRelativePointer.from(pointer)).toThrowWithMessage(
                InvalidSyntaxError,
                'A relative JSON pointer must start with a non-negative '
                + 'integer optionally followed by a hash character.',
            );
        },
    );

    it('should have at least one segment', () => {
        expect(() => JsonRelativePointer.from([])).toThrowWithMessage(
            InvalidSyntaxError,
            'A relative pointer must have at least one segment.',
        );
    });

    it('should validate escape sequences', () => {
        expect(() => JsonRelativePointer.parse('1/~a')).toThrowWithMessage(
            InvalidSyntaxError,
            'Invalid escape sequence in "/1/~a".',
        );
    });

    it('should fail to parse an empty string', () => {
        expect(() => JsonRelativePointer.parse('')).toThrowWithMessage(
            InvalidSyntaxError,
            'A relative JSON pointer must start with a non-negative '
            + 'integer optionally followed by a hash character.',
        );
    });

    it.each(
        [
            ['1#', ['1#']],
            ['1+1', ['1+1']],
            ['1-1', ['1-1']],
            ['1-1/foo', ['1-1', 'foo']],
            ['1/foo/bar', [1, 'foo', 'bar']],
            ['1/foo/0', [1, 'foo', 0]],
            ['1/foo/-', [1, 'foo', '-']],
            ['1/foo/~0', [1, 'foo', '~']],
            ['1/foo/~1', [1, 'foo', '/']],
            ['1/foo/~1~0', [1, 'foo', '/~']],
            ['1/foo/~0~1', [1, 'foo', '~/']],
            ['1/foo/~01', [1, 'foo', '~1']],
            ['1/foo/~10', [1, 'foo', '/0']],
        ],
    )('should parse "%s" into %s', (input: string, expectedSegments: JsonPointerSegments) => {
        expect(JsonRelativePointer.parse(input).getSegments()).toStrictEqual(expectedSegments);
    });

    it('should determine whether the pointer references a key', () => {
        expect(JsonRelativePointer.parse('1#').isKeyPointer()).toBe(true);
        expect(JsonRelativePointer.parse('1').isKeyPointer()).toBe(false);
        expect(JsonRelativePointer.parse('1/2#').isKeyPointer()).toBe(false);
    });

    it('should return the parent pointer', () => {
        expect(JsonRelativePointer.parse('1/foo/bar/baz').getParent())
            .toStrictEqual(JsonRelativePointer.parse('1/foo/bar'));
    });

    it('should return the parent index', () => {
        expect(JsonRelativePointer.parse('0').getParentIndex()).toBe(0);
        expect(JsonRelativePointer.parse('1#').getParentIndex()).toBe(1);
        expect(JsonRelativePointer.parse('1/foo').getParentIndex()).toBe(1);
    });

    it('should return the parent index offset', () => {
        expect(JsonRelativePointer.parse('1').getParentIndexOffset()).toBe(0);
        expect(JsonRelativePointer.parse('1#').getParentIndexOffset()).toBe(0);
        expect(JsonRelativePointer.parse('1/foo').getParentIndexOffset()).toBe(0);
        expect(JsonRelativePointer.parse('0-1').getParentIndexOffset()).toBe(-1);
        expect(JsonRelativePointer.parse('0+1').getParentIndexOffset()).toBe(1);
        expect(JsonRelativePointer.parse('0-1#').getParentIndexOffset()).toBe(-1);
        expect(JsonRelativePointer.parse('0+1#').getParentIndexOffset()).toBe(1);
        expect(JsonRelativePointer.parse('1+1/foo').getParentIndexOffset()).toBe(1);
        expect(JsonRelativePointer.parse('1-1/foo').getParentIndexOffset()).toBe(-1);
    });

    it('should fail to return the parent of a unresolved segment', () => {
        expect(() => JsonRelativePointer.parse('1').getParent()).toThrowWithMessage(
            JsonPointerError,
            'Cannot get the parent of a unresolved segment.',
        );
    });

    it('should return the pointer segments', () => {
        expect(JsonRelativePointer.parse('1/foo/0/baz').getSegments())
            .toStrictEqual([1, 'foo', 0, 'baz']);

        expect(JsonRelativePointer.parse('1#').getSegments()).toStrictEqual(['1#']);
    });

    it.each(
        [
            [
                JsonRelativePointer.parse('1'),
                JsonPointer.root(),
                JsonRelativePointer.parse('1'),
            ],
            [
                JsonRelativePointer.parse('1/foo'),
                JsonPointer.parse('/bar'),
                JsonRelativePointer.parse('1/foo/bar'),
            ],
            [
                JsonRelativePointer.parse('1/foo'),
                ['bar'],
                JsonRelativePointer.parse('1/foo/bar'),
            ],
            [
                JsonRelativePointer.parse('1/foo'),
                '/bar',
                JsonRelativePointer.parse('1/foo/bar'),
            ],
            [
                JsonRelativePointer.parse('1/foo'),
                1,
                JsonRelativePointer.parse('1/foo/1'),
            ],
        ],
    )('should join "%s" with "%s" resulting in %s', (
        left: JsonRelativePointer,
        right: JsonPointerLike,
        result: JsonRelativePointer,
    ) => {
        expect(left.joinedWith(right)).toStrictEqual(result);
    });

    it('should fail to join a relative key target with another pointer', () => {
        expect(() => JsonRelativePointer.parse('1#').joinedWith(JsonPointer.root())).toThrowWithMessage(
            JsonPointerError,
            'Cannot join a key pointer.',
        );
    });

    it("should determine whether it's logically equal to another pointer", () => {
        const pointer = JsonRelativePointer.parse('1/foo/qux');

        expect(pointer.equals({})).toBe(false);
        expect(pointer.equals(pointer)).toBe(true);
        expect(JsonRelativePointer.parse('1/foo/qux')
            .equals(JsonRelativePointer.parse('1/foo/qux'))).toBe(true);
        expect(pointer.equals(JsonRelativePointer.parse('1/bar'))).toBe(false);
        expect(pointer.equals(JsonRelativePointer.parse('1/bar/baz'))).toBe(false);
    });

    it('should provide the remainder pointer', () => {
        expect(JsonRelativePointer.parse('1#').getRemainderPointer().toString()).toBe('');
        expect(JsonRelativePointer.parse('1+1').getRemainderPointer().toString()).toBe('');
        expect(JsonRelativePointer.parse('1/foo').getRemainderPointer().toString()).toBe('/foo');
        expect(JsonRelativePointer.parse('1+1/foo').getRemainderPointer().toString()).toBe('/foo');
    });

    it.each(
        [
            [
                JsonRelativePointer.parse('1/foo'),
                JsonPointer.parse('/bar'),
                JsonPointer.parse('/foo'),
            ],
            [
                JsonRelativePointer.parse('0/qux'),
                JsonPointer.parse('/foo/bar/quz'),
                JsonPointer.parse('/foo/bar/quz/qux'),
            ],
            [
                JsonRelativePointer.parse('1/qux'),
                JsonPointer.parse('/foo/bar/quz'),
                JsonPointer.parse('/foo/bar/qux'),
            ],
            [
                JsonRelativePointer.parse('2/qux'),
                JsonPointer.parse('/foo/bar/quz'),
                JsonPointer.parse('/foo/qux'),
            ],
            [
                JsonRelativePointer.parse('3/qux'),
                JsonPointer.parse('/foo/bar/quz'),
                JsonPointer.parse('/qux'),
            ],
            [
                JsonRelativePointer.parse('0/foo'),
                JsonPointer.parse('/bar'),
                JsonPointer.parse('/bar/foo'),
            ],
            [
                JsonRelativePointer.parse('0/foo'),
                JsonPointer.root(),
                JsonPointer.parse('/foo'),
            ],
            [
                JsonRelativePointer.parse('0/foo'),
                '',
                JsonPointer.parse('/foo'),
            ],
        ],
    )(
        'should resolve the pointer "%s" against "%s" resulting in "%s"',
        (
            relativePointer: JsonRelativePointer,
            basePointer: JsonPointerLike,
            result: JsonPointer,
        ) => {
            expect(relativePointer.resolve(basePointer)).toStrictEqual(result);
        },
    );

    it.each(
        [
            [
                JsonRelativePointer.parse('1'),
                JsonPointer.root(),
                'The relative pointer is out of bounds.',
            ],
            [
                JsonRelativePointer.parse('3'),
                JsonPointer.parse('/foo/bar'),
                'The relative pointer is out of bounds.',
            ],
            [
                JsonRelativePointer.parse('3#'),
                JsonPointer.parse('/foo/bar'),
                'A key pointer cannot be resolved to an absolute pointer.',
            ],
            [
                JsonRelativePointer.parse('3+2'),
                JsonPointer.parse('/foo/bar'),
                'A pointer with an offset cannot be resolved to an absolute pointer.',
            ],
        ],
    )(
        'should fail tp resolve the pointer "%s" against "%s" reporting "%s"',
        (
            relativePointer: JsonRelativePointer,
            basePointer: JsonPointer,
            expectedError: string,
        ) => {
            expect(() => relativePointer.resolve(basePointer)).toThrowWithMessage(
                JsonPointerError,
                expectedError,
            );
        },
    );

    it.each(
        [
            [
                1,
                JsonPointer.root(),
                JsonRelativePointer.parse('0'),
                1,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0'),
                'baz',
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('1/0'),
                'bar',
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0-1'),
                'bar',
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0#'),
                1,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0-1#'),
                0,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('1#'),
                'foo',
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('0/objects'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('1/nested/objects'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('2/foo/0'),
                'bar',
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('0#'),
                'nested',
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('1#'),
                'highly',
            ],
        ],
    )(
        'should get value from %o starting from %s with pointer %s resulting in %s',
        (
            root: RootValue,
            basePointer: JsonPointer,
            relativePointer: JsonRelativePointer,
            result: JsonValue,
        ) => {
            expect(relativePointer.get(root, basePointer)).toStrictEqual(result);
        },
    );

    it.each(
        [
            {
                root: null,
                basePointer: JsonPointer.parse('/invalid'),
                relativePointer: JsonRelativePointer.parse('0'),
                error: {
                    type: InvalidReferenceError,
                    message: 'Cannot read value at "".',
                },
            },
            {
                root: {nested: 'foo'},
                basePointer: JsonPointer.parse('/nested'),
                relativePointer: JsonRelativePointer.parse('2'),
                error: {
                    type: JsonPointerError,
                    message: 'The relative pointer is out of bounds.',
                },
            },
            {
                root: {nested: 'foo'},
                basePointer: JsonPointer.parse('/nested'),
                relativePointer: JsonRelativePointer.parse('1+1'),
                error: {
                    type: InvalidReferenceError,
                    message: 'An offset can only be applied to array elements.',
                },
            },
            {
                root: {nested: 'foo'},
                basePointer: JsonPointer.parse('/nested'),
                relativePointer: JsonRelativePointer.parse('1+1#'),
                error: {
                    type: InvalidReferenceError,
                    message: 'An offset can only be applied to array elements.',
                },
            },
            {
                root: {nested: 'foo'},
                basePointer: JsonPointer.parse('/nested'),
                relativePointer: JsonRelativePointer.parse('1-1'),
                error: {
                    type: InvalidReferenceError,
                    message: 'An offset can only be applied to array elements.',
                },
            },
            {
                root: {nested: 'foo'},
                basePointer: JsonPointer.parse('/nested'),
                relativePointer: JsonRelativePointer.parse('1-1#'),
                error: {
                    type: InvalidReferenceError,
                    message: 'An offset can only be applied to array elements.',
                },
            },
            {
                root: {nested: [0, 1]},
                basePointer: JsonPointer.parse('/nested/0'),
                relativePointer: JsonRelativePointer.parse('0-1#'),
                error: {
                    type: InvalidReferenceError,
                    message: 'The element index is out of bounds.',
                },
            },
            {
                root: {nested: [0, 1]},
                basePointer: JsonPointer.parse('/nested/1'),
                relativePointer: JsonRelativePointer.parse('0+1#'),
                error: {
                    type: InvalidReferenceError,
                    message: 'The element index is out of bounds.',
                },
            },
            {
                root: {nested: 'foo'},
                basePointer: JsonPointer.parse('/nested'),
                relativePointer: JsonRelativePointer.parse('1#'),
                error: {
                    type: InvalidReferenceError,
                    message: 'The root value has no key.',
                },
            },
        ],
    )(
        // eslint-disable-next-line max-len -- Disabled for better readability
        'should fail to get value from $root starting from $basePointer with pointer $relativePointer reporting "error.message"',
        ({root, basePointer, relativePointer, error: {type, message}}) => {
            expect(() => relativePointer.get(root, basePointer)).toThrowWithMessage(
                type,
                message,
            );
        },
    );

    it.each(
        [
            [
                false,
                JsonPointer.root(),
                JsonRelativePointer.parse('0'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('1/0'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0-1'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0#'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0-1#'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('1#'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('0/objects'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('1/nested/objects'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('2/foo/0'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('0#'),
                true,
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('1#'),
                true,
            ],
            [
                null,
                JsonPointer.parse('/invalid'),
                JsonRelativePointer.parse('0'),
                false,
            ],
            [
                {nested: 'foo'},
                JsonPointer.parse('/nested'),
                JsonRelativePointer.parse('2'),
                false,
            ],
            [
                {nested: 'foo'},
                JsonPointer.parse('/nested'),
                JsonRelativePointer.parse('1+1'),
                false,
            ],
            [
                {nested: 'foo'},
                JsonPointer.parse('/nested'),
                JsonRelativePointer.parse('1+1#'),
                false,
            ],
            [
                {nested: 'foo'},
                JsonPointer.parse('/nested'),
                JsonRelativePointer.parse('1-1'),
                false,
            ],
            [
                {nested: 'foo'},
                JsonPointer.parse('/nested'),
                JsonRelativePointer.parse('1-1#'),
                false,
            ],
            [
                {nested: [0, 1]},
                JsonPointer.parse('/nested/0'),
                JsonRelativePointer.parse('0-1#'),
                false,
            ],
            [
                {nested: [0, 1]},
                JsonPointer.parse('/nested/1'),
                JsonRelativePointer.parse('0+1#'),
                false,
            ],
            [
                {nested: 'foo'},
                JsonPointer.parse('/nested'),
                JsonRelativePointer.parse('1#'),
                false,
            ],
        ],
    )(
        'should check in %o if %s exists from %s resulting in %s',
        (
            value: JsonValue,
            pointer: JsonPointer,
            relativePointer: JsonRelativePointer,
            result: boolean,
        ) => {
            expect(relativePointer.has(value, pointer)).toStrictEqual(result);
        },
    );

    it.each(
        [
            [
                false,
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: true,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested/objects'),
                JsonRelativePointer.parse('0'),
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
            ],
            [
                'quz',
                {
                    foo: ['bar', 'baz'],
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('0/1'),
                {
                    foo: ['bar', 'quz'],
                },
            ],
            [
                'quz',
                {
                    foo: ['bar', 'baz'],
                },
                JsonPointer.parse('/foo/0'),
                JsonRelativePointer.parse('0+1'),
                {
                    foo: ['bar', 'quz'],
                },
            ],
            [
                'quz',
                {
                    foo: ['bar', 'baz'],
                },
                JsonPointer.parse('/foo/1'),
                JsonRelativePointer.parse('0-1'),
                {
                    foo: ['quz', 'baz'],
                },
            ],
        ],
    )(
        'should set %o in %o at %s from %s resulting in %o',
        (
            value: JsonValue,
            root: JsonValue,
            basePointer: JsonPointer,
            relativePointer: JsonRelativePointer,
            result: JsonValue,
        ) => {
            relativePointer.set(root, value, basePointer);

            expect(root).toStrictEqual(result);
        },
    );

    it.each(
        [
            [
                {},
                JsonPointer.root(),
                JsonRelativePointer.parse('0'),
                'Cannot set the root value.',
            ],
            [
                {
                    foo: 'bar',
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('1'),
                'Cannot set the root value.',
            ],
            [
                {
                    foo: 'bar',
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('1#'),
                'Cannot write to a key.',
            ],
        ],
    )(
        'should fail to set to %o at %s from %s because %S',
        (
            root: JsonValue,
            basePointer: JsonPointer,
            relativePointer: JsonRelativePointer,
            error: string,
        ) => {
            expect(() => relativePointer.set(root, true, basePointer)).toThrowWithMessage(
                JsonPointerError,
                error,
            );
        },
    );

    it.each(
        [
            [
                {
                    foo: ['bar', 'baz'],
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('0/1'),
                {
                    foo: ['bar'],
                },
            ],
            [
                {
                    foo: ['bar', 'baz'],
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('0'),
                {},
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('1/highly/nested/objects'),
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {},
                    },
                },
            ],
            [
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {
                            objects: false,
                        },
                    },
                },
                JsonPointer.parse('/highly/nested'),
                JsonRelativePointer.parse('0/objects'),
                {
                    foo: ['bar', 'baz'],
                    highly: {
                        nested: {},
                    },
                },
            ],
        ],
    )(
        'should unset from %o at %s %s resulting in %o',
        (
            root: RootValue,
            basePointer: JsonPointer,
            relativePointer: JsonRelativePointer,
            result: JsonValue,
        ) => {
            relativePointer.unset(root, basePointer);

            expect(root).toStrictEqual(result);
        },
    );

    it.each(
        [
            [
                {},
                JsonPointer.root(),
                JsonRelativePointer.parse('0'),
                'Cannot unset the root value.',
            ],
            [
                {
                    foo: 'bar',
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('1'),
                'Cannot unset the root value.',
            ],
            [
                {
                    foo: 'bar',
                },
                JsonPointer.parse('/foo'),
                JsonRelativePointer.parse('1#'),
                'Cannot write to a key.',
            ],
        ],
    )(
        'should fail to unset from %o at %s %s because %S',
        (
            root: RootValue,
            basePointer: JsonPointer,
            relativePointer: JsonRelativePointer,
            error: string,
        ) => {
            expect(() => relativePointer.unset(root, basePointer)).toThrowWithMessage(
                JsonPointerError,
                error,
            );
        },
    );

    it('can be converted to string', () => {
        expect(JsonRelativePointer.parse('1#').toString()).toBe('1#');
        expect(JsonRelativePointer.parse('1/foo/bar').toString()).toBe('1/foo/bar');
        expect(JsonRelativePointer.parse('1/foo/~0').toString()).toBe('1/foo/~0');
        expect(JsonRelativePointer.parse('1/foo/~1').toString()).toBe('1/foo/~1');
    });

    it('can be serialized to JSON', () => {
        expect(JsonRelativePointer.parse('1#').toJSON()).toBe('1#');
        expect(JsonRelativePointer.parse('1/foo/bar').toJSON()).toBe('1/foo/bar');
        expect(JsonRelativePointer.parse('1/foo/~0').toJSON()).toBe('1/foo/~0');
        expect(JsonRelativePointer.parse('1/foo/~1').toJSON()).toBe('1/foo/~1');
    });
});
