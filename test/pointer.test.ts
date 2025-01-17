import {JsonValue} from '@croct/json';
import {
    Entry,
    InvalidReferenceError,
    InvalidSyntaxError,
    JsonPointer,
    JsonPointerError,
    JsonPointerLike,
    JsonPointerSegments,
    RootValue,
} from '../src';

describe('A JSON Pointer', () => {
    function toArray(iterator: Iterator<any>): any[] {
        const array: any[] = [];

        let {done = true, value} = iterator.next();

        while (!done) {
            array.push(value);
            ({done = true, value} = iterator.next());
        }

        return array;
    }

    it.each(
        [
            ['', ''],
            ['/foo', '/foo'],
            ['/foo/bar', '/foo/bar'],
            ['/foo/-', '/foo/-'],
            ['/foo/1', '/foo/1'],
            [[], ''],
            [['foo'], '/foo'],
            [['foo', 'bar'], '/foo/bar'],
            [['foo', 1], '/foo/1'],
            [['foo', '-'], '/foo/-'],
            [0, '/0'],
            [['0'], '/0'],
            [Number.MAX_SAFE_INTEGER, `/${Number.MAX_SAFE_INTEGER}`],
            [JsonPointer.parse('/foo/bar'), '/foo/bar'],
        ],
    )('should convert "%s" into "%s"', (pointer: JsonPointerLike, expected: string) => {
        expect(JsonPointer.from(pointer)).toStrictEqual(JsonPointer.parse(expected));
    });

    it.each(
        [
            [[-1], 'Invalid integer segment "-1".'],
            [[1.5], 'Invalid integer segment "1.5".'],
            [[Number.NaN], 'Invalid integer segment "NaN".'],
            [[Number.MAX_VALUE], `Invalid integer segment "${Number.MAX_VALUE}".`],
            [[Number.MIN_VALUE], `Invalid integer segment "${Number.MIN_VALUE}".`],
            [[Number.POSITIVE_INFINITY], `Invalid integer segment "${Number.POSITIVE_INFINITY}".`],
            [[Number.NEGATIVE_INFINITY], `Invalid integer segment "${Number.NEGATIVE_INFINITY}".`],
        ],
    )(
        'should fail to convert "%s" because "%s"',
        (pointer: JsonPointerLike, expectedError: string) => {
            expect(() => JsonPointer.from(pointer)).toThrowWithMessage(
                InvalidSyntaxError,
                expectedError,
            );
        },
    );

    it.each(
        [
            ['foo/bar', 'A non-root pointer must start with a slash, actual "foo/bar".'],
            ['~foo', 'Invalid escape sequence in "~foo".'],
            ['/~a', 'Invalid escape sequence in "/~a".'],
            ['~1/foo', 'A non-root pointer must start with a slash, actual "~1/foo".'],
        ],
    )('should fail to parse "%s" reporting %s', (input: string, expectedError: string) => {
        expect(() => JsonPointer.parse(input)).toThrowWithMessage(
            InvalidSyntaxError,
            expectedError,
        );
    });

    it.each(
        [
            ['', []],
            ['/foo/bar', ['foo', 'bar']],
            ['/foo/0', ['foo', 0]],
            ['/foo/-', ['foo', '-']],
            ['/foo/~0', ['foo', '~']],
            ['/foo/~1', ['foo', '/']],
            ['/foo/~1~0', ['foo', '/~']],
            ['/foo/~0~1', ['foo', '~/']],
            ['/foo/~01', ['foo', '~1']],
            ['/foo/~10', ['foo', '/0']],
        ],
    )('should parse "%s" into %s', (input: string, expectedSegments: JsonPointerSegments) => {
        expect(JsonPointer.parse(input).getSegments()).toStrictEqual(expectedSegments);
    });

    it('should determine whether the pointer refers to an array element', () => {
        expect(JsonPointer.parse('/foo/bar/1').isIndex()).toBe(true);
        expect(JsonPointer.parse('/foo/bar').isIndex()).toBe(false);
    });

    it('should return the depth of the pointer', () => {
        expect(JsonPointer.parse('/foo/-').getDepth()).toEqual(2);
        expect(JsonPointer.parse('/foo/0/bar/1/baz').getDepth()).toEqual(5);
        expect(JsonPointer.root().getDepth()).toEqual(0);
    });

    it('should return the parent pointer', () => {
        expect(JsonPointer.parse('/foo/bar/baz').getParent())
            .toStrictEqual(JsonPointer.parse('/foo/bar'));
    });

    it('should fail to return the parent of the root pointer', () => {
        expect(() => JsonPointer.root().getParent()).toThrowWithMessage(
            JsonPointerError,
            'Cannot get parent of root pointer.',
        );
    });

    it('should return the pointer segments', () => {
        expect(JsonPointer.parse('/foo/0/baz').getSegments()).toStrictEqual(['foo', 0, 'baz']);
    });

    it.each(
        [
            [
                JsonPointer.root(),
                0,
                JsonPointer.root(),
            ],
            [
                JsonPointer.parse('/foo'),
                1,
                JsonPointer.parse('/foo'),
            ],
            [
                JsonPointer.parse('/foo'),
                0,
                JsonPointer.root(),
            ],
        ],
    )(
        'should return truncate "%s" at depth %s resulting in "%s"',
        (pointer: JsonPointer, depth: number, expectedPointer: JsonPointer) => {
            expect(pointer.truncatedAt(depth)).toStrictEqual(expectedPointer);
        },
    );

    it('should fail to create a sub pointer if the depth is out of bounds', () => {
        expect(() => JsonPointer.parse('/foo').truncatedAt(-1)).toThrowWithMessage(
            JsonPointerError,
            'Depth -1 is out of bounds.',
        );

        expect(() => JsonPointer.parse('/foo').truncatedAt(2)).toThrowWithMessage(
            JsonPointerError,
            'Depth 2 is out of bounds.',
        );
    });

    it.each(
        [
            [
                JsonPointer.parse('/bar'),
                JsonPointer.root(),
                JsonPointer.parse('/bar'),
            ],
            [
                JsonPointer.root(),
                JsonPointer.parse('/bar'),
                JsonPointer.parse('/bar'),
            ],
            [
                JsonPointer.parse('/foo'),
                JsonPointer.parse('/bar'),
                JsonPointer.parse('/foo/bar'),
            ],
            [
                JsonPointer.parse('/foo'),
                ['bar'],
                JsonPointer.parse('/foo/bar'),
            ],
            [
                JsonPointer.parse('/foo'),
                '/bar',
                JsonPointer.parse('/foo/bar'),
            ],
            [
                JsonPointer.parse('/foo'),
                1,
                JsonPointer.parse('/foo/1'),
            ],
        ],
    )('should join "%s" with "%s" resulting in %s', (
        left: JsonPointer,
        right: JsonPointerLike,
        result: JsonPointer,
    ) => {
        expect(left.joinedWith(right)).toStrictEqual(result);
    });

    it.each(
        [
            [
                JsonPointer.root(),
                {foo: 'bar'},
                {foo: 'bar'},
            ],
            [
                JsonPointer.parse('/foo'),
                {foo: 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/foo'),
                {foo: undefined},
                undefined,
            ],
            [
                JsonPointer.root(),
                ['foo'],
                ['foo'],
            ],
            [
                JsonPointer.parse('/0'),
                ['foo'],
                'foo',
            ],
            [
                JsonPointer.parse('/foo/0'),
                {foo: ['bar']},
                'bar',
            ],
            [
                JsonPointer.parse('/a~1b'),
                {'a/b': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/c%d'),
                {'c%d': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/e^f'),
                {'e^f': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/g|h'),
                {'g|h': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/i\\j'),
                {'i\\j': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/k"l'),
                {'k"l': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/ '),
                {' ': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/m~0n'),
                {'m~n': 'bar'},
                'bar',
            ],
            [
                JsonPointer.parse('/'),
                {'': 'bar'},
                'bar',
            ],
        ],
    )(
        'should get value at "%s" from %s',
        (pointer: JsonPointer, root: RootValue, value: RootValue) => {
            expect(pointer.get(root)).toStrictEqual(value);
        },
    );

    it.each(
        [
            [
                JsonPointer.parse('/foo'),
                {bar: 'foo'},
                'Property "foo" does not exist at "".',
            ],
            [
                JsonPointer.parse('/foo'),
                [],
                'Expected an object at "", got an array.',
            ],
            [
                JsonPointer.parse('/1'),
                [],
                'Index 1 is out of bounds at "".',
            ],
            [
                JsonPointer.parse('/-'),
                [],
                'Index 0 is out of bounds at "".',
            ],
            [
                JsonPointer.parse('/0'),
                {},
                'Expected array at "", got object.',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: null},
                'Cannot read value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: true},
                'Cannot read value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 1},
                'Cannot read value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 'bar'},
                'Cannot read value at "/foo".',
            ],
        ],
    )(
        'should fail to get value at "%s" from %s because "%s"',
        (pointer: JsonPointer, root: RootValue, expectedError: string) => {
            expect(() => pointer.get(root)).toThrowWithMessage(
                InvalidReferenceError,
                expectedError,
            );
        },
    );

    it.each(
        [
            [
                JsonPointer.root(),
                {foo: 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/foo'),
                {foo: 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/foo'),
                {foo: undefined},
                true,
            ],
            [
                JsonPointer.parse('/bar'),
                {foo: 'bar'},
                false,
            ],
            [
                JsonPointer.root(),
                ['foo'],
                true,
            ],
            [
                JsonPointer.parse('/0'),
                ['foo'],
                true,
            ],
            [
                JsonPointer.parse('/1'),
                ['foo'],
                false,
            ],
            [
                JsonPointer.parse('/-'),
                ['foo'],
                false,
            ],
            [
                JsonPointer.parse('/foo/0'),
                {foo: ['bar']},
                true,
            ],
            [
                JsonPointer.parse('/foo/1'),
                {foo: ['bar']},
                false,
            ],
            [
                JsonPointer.parse('/a~1b'),
                {'a/b': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/c%d'),
                {'c%d': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/e^f'),
                {'e^f': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/g|h'),
                {'g|h': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/i\\j'),
                {'i\\j': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/k"l'),
                {'k"l': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/ '),
                {' ': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/m~0n'),
                {'m~n': 'bar'},
                true,
            ],
            [
                JsonPointer.parse('/'),
                {'': 'bar'},
                true,
            ],
        ],
    )(
        'should report the existence of a value at "%s" in %s as %s',
        (pointer: JsonPointer, root: RootValue, result: boolean) => {
            expect(pointer.has(root)).toStrictEqual(result);
        },
    );

    it.each(
        [
            [
                JsonPointer.parse('/bar'),
                {bar: 'foo'},
                'baz',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/bar'),
                {bar: 'foo'},
                undefined,
                {bar: undefined},
            ],
            [
                JsonPointer.parse('/foo'),
                {bar: 'foo'},
                'baz',
                {
                    bar: 'foo',
                    foo: 'baz',
                },
            ],
            [
                JsonPointer.parse('/0'),
                ['foo'],
                'bar',
                ['bar'],
            ],
            [
                JsonPointer.parse('/-'),
                ['foo'],
                'bar',
                ['foo', 'bar'],
            ],
            [
                JsonPointer.parse('/foo/0'),
                {foo: ['bar']},
                'baz',
                {foo: ['baz']},
            ],
            [
                JsonPointer.parse('/a~1b'),
                {'a/b': 'bar'},
                'baz',
                {'a/b': 'baz'},
            ],
            [
                JsonPointer.parse('/c%d'),
                {'c%d': 'bar'},
                'baz',
                {'c%d': 'baz'},
            ],
            [
                JsonPointer.parse('/e^f'),
                {'e^f': 'bar'},
                'baz',
                {'e^f': 'baz'},
            ],
            [
                JsonPointer.parse('/g|h'),
                {'g|h': 'bar'},
                'baz',
                {'g|h': 'baz'},
            ],
            [
                JsonPointer.parse('/i\\j'),
                {'i\\j': 'bar'},
                'baz',
                {'i\\j': 'baz'},
            ],
            [
                JsonPointer.parse('/k"l'),
                {'k"l': 'bar'},
                'baz',
                {'k"l': 'baz'},
            ],
            [
                JsonPointer.parse('/ '),
                {' ': 'bar'},
                'baz',
                {' ': 'baz'},
            ],
            [
                JsonPointer.parse('/m~0n'),
                {'m~n': 'bar'},
                'baz',
                {'m~n': 'baz'},
            ],
            [
                JsonPointer.parse('/'),
                {'': 'bar'},
                'baz',
                {'': 'baz'},
            ],
        ],
    )(
        'should set value at "%s" into %s',
        (
            pointer: JsonPointer,
            root: RootValue,
            value: RootValue,
            expectedResult: RootValue,
        ) => {
            pointer.set(root, value);

            expect(root).toStrictEqual(expectedResult);
        },
    );

    it.each(
        [
            [
                JsonPointer.parse('/foo'),
                [],
                'Expected an object at "", got an array.',
            ],
            [
                JsonPointer.parse('/0'),
                {},
                'Expected array at "", got object.',
            ],
        ],
    )(
        'should fail to set value at "%s" into %s because "%s"',
        (pointer: JsonPointer, root: RootValue, errorMessage: string) => {
            expect(() => pointer.set(root, null)).toThrowWithMessage(
                Error,
                errorMessage,
            );
        },
    );

    it.each(
        [
            [
                JsonPointer.parse('/foo/bar'),
                {bar: 'foo'},
                'Property "foo" does not exist at "".',
            ],
            [
                JsonPointer.parse('/1'),
                [],
                'Index 1 is out of bounds at "".',
            ],
            [
                JsonPointer.parse('/-/0'),
                [[]],
                'Index 1 is out of bounds at "".',
            ],
            [
                JsonPointer.parse('/1'),
                [],
                'Index 1 is out of bounds at "".',
            ],
        ],
    )(
        'should fail to set value at "%s" into %s with invalid reference error because "%s"',
        (pointer: JsonPointer, root: RootValue, errorMessage: string) => {
            expect(() => pointer.set(root, null)).toThrowWithMessage(
                InvalidReferenceError,
                errorMessage,
            );
        },
    );

    it.each(
        [
            [
                JsonPointer.root(),
                {bar: 'foo'},
                'Cannot set root value.',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: null},
                'Cannot set value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: true},
                'Cannot set value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 1},
                'Cannot set value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 'bar'},
                'Cannot set value at "/foo".',
            ],
        ],
    )(
        'should fail to set value at "%s" into %s with json pointer error because "%s"',
        (pointer: JsonPointer, root: RootValue, errorMessage: string) => {
            expect(() => pointer.set(root, null)).toThrowWithMessage(
                JsonPointerError,
                errorMessage,
            );
        },
    );

    it.each(
        [
            [
                JsonPointer.parse('/foo/bar'),
                {},
                undefined,
                {},
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: null},
                undefined,
                {foo: null},
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: true},
                undefined,
                {foo: true},
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 1},
                undefined,
                {foo: 1},
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 'bar'},
                undefined,
                {foo: 'bar'},
            ],
            [
                JsonPointer.parse('/foo'),
                {
                    foo: 'bar',
                    bar: 'baz',
                },
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/foo'),
                ['bar'],
                undefined,
                ['bar'],
            ],
            [
                JsonPointer.parse('/1'),
                {bar: 'baz'},
                undefined,
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/foo'),
                {bar: 'baz'},
                undefined,
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/1'),
                ['foo'],
                undefined,
                ['foo'],
            ],
            [
                JsonPointer.parse('/1'),
                ['foo', 'baz'],
                'baz',
                ['foo'],
            ],
            [
                JsonPointer.parse('/0'),
                ['foo', 'baz'],
                'foo',
                ['baz'],
            ],
            [
                JsonPointer.parse('/-'),
                ['foo', 'baz'],
                undefined,
                ['foo', 'baz'],
            ],
            [
                JsonPointer.parse('/foo/0'),
                {foo: ['bar']},
                'bar',
                {foo: []},
            ],
            [
                JsonPointer.parse('/a~1b'),
                {'a/b': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/c%d'),
                {'c%d': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/e^f'),
                {'e^f': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/g|h'),
                {'g|h': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/i\\j'),
                {'i\\j': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/k"l'),
                {'k"l': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/ '),
                {' ': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/m~0n'),
                {'m~n': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
            [
                JsonPointer.parse('/'),
                {'': 'bar', bar: 'baz'},
                'bar',
                {bar: 'baz'},
            ],
        ],
    )(
        'should unset value at "%s" from %s, removing %s and resulting in %s',
        (
            pointer: JsonPointer,
            root: RootValue,
            unsetValue: JsonValue|undefined,
            expectedResult: JsonValue,
        ) => {
            expect(pointer.unset(root)).toStrictEqual(unsetValue);
            expect(root).toStrictEqual(expectedResult);
        },
    );

    it('should fail to unset the root value', () => {
        expect(() => JsonPointer.root().unset({})).toThrowWithMessage(
            InvalidReferenceError,
            'Cannot unset the root value.',
        );
    });

    it.each<[JsonPointer, RootValue, Array<Entry<JsonValue>>]>(
        [
            [
                JsonPointer.root(),
                {foo: 'bar'},
                [[null, {foo: 'bar'}]],
            ],
            [
                JsonPointer.parse('/foo'),
                {foo: 'bar'},
                [[null, {foo: 'bar'}], ['foo', 'bar']],
            ],
            [
                JsonPointer.root(),
                ['foo'],
                [[null, ['foo']]],
            ],
            [
                JsonPointer.parse('/0'),
                ['foo'],
                [[null, ['foo']], [0, 'foo']],
            ],
            [
                JsonPointer.parse('/foo/0'),
                {foo: ['bar']},
                [[null, {foo: ['bar']}], ['foo', ['bar']], [0, 'bar']],
            ],
            [
                JsonPointer.parse('/a~1b'),
                {'a/b': 'bar'},
                [[null, {'a/b': 'bar'}], ['a/b', 'bar']],
            ],
            [
                JsonPointer.parse('/c%d'),
                {'c%d': 'bar'},
                [[null, {'c%d': 'bar'}], ['c%d', 'bar']],
            ],
            [
                JsonPointer.parse('/e^f'),
                {'e^f': 'bar'},
                [[null, {'e^f': 'bar'}], ['e^f', 'bar']],
            ],
            [
                JsonPointer.parse('/g|h'),
                {'g|h': 'bar'},
                [[null, {'g|h': 'bar'}], ['g|h', 'bar']],
            ],
            [
                JsonPointer.parse('/i\\j'),
                {'i\\j': 'bar'},
                [[null, {'i\\j': 'bar'}], ['i\\j', 'bar']],
            ],
            [
                JsonPointer.parse('/k"l'),
                {'k"l': 'bar'},
                [[null, {'k"l': 'bar'}], ['k"l', 'bar']],
            ],
            [
                JsonPointer.parse('/ '),
                {' ': 'bar'},
                [[null, {' ': 'bar'}], [' ', 'bar']],
            ],
            [
                JsonPointer.parse('/m~0n'),
                {'m~n': 'bar'},
                [[null, {'m~n': 'bar'}], ['m~n', 'bar']],
            ],
            [
                JsonPointer.parse('/'),
                {'': 'bar'},
                [[null, {'': 'bar'}], ['', 'bar']],
            ],
        ],
    )(
        'should traverse "%s" from %o and return %o',
        (pointer: JsonPointer, root: RootValue, entries: Array<Entry<JsonValue>>) => {
            expect(toArray(pointer.traverse(root))).toStrictEqual(entries);
        },
    );

    it.each(
        [
            [
                JsonPointer.parse('/foo'),
                {bar: 'foo'},
                'Property "foo" does not exist at "".',
            ],
            [
                JsonPointer.parse('/foo'),
                [],
                'Expected an object at "", got an array.',
            ],
            [
                JsonPointer.parse('/1'),
                [],
                'Index 1 is out of bounds at "".',
            ],
            [
                JsonPointer.parse('/-'),
                [],
                'Index 0 is out of bounds at "".',
            ],
            [
                JsonPointer.parse('/0'),
                {},
                'Expected array at "", got object.',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: null},
                'Cannot read value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: true},
                'Cannot read value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 1},
                'Cannot read value at "/foo".',
            ],
            [
                JsonPointer.parse('/foo/bar'),
                {foo: 'bar'},
                'Cannot read value at "/foo".',
            ],
        ],
    )(
        'should fail to traverse "%s" from %o because "%s"',
        (pointer: JsonPointer, root: RootValue, expectedError: string) => {
            expect(() => toArray(pointer.traverse(root))).toThrowWithMessage(InvalidReferenceError, expectedError);
        },
    );

    it("should determine whether it's logically equal to another pointer", () => {
        const pointer = JsonPointer.parse('/foo/qux');

        expect(pointer.equals({})).toBe(false);
        expect(pointer.equals(pointer)).toBe(true);
        expect(JsonPointer.parse('/foo/qux').equals(JsonPointer.parse('/foo/qux'))).toBe(true);
        expect(pointer.equals(JsonPointer.parse('/bar'))).toBe(false);
        expect(pointer.equals(JsonPointer.parse('/bar/baz'))).toBe(false);
    });

    it('can be converted to string', () => {
        expect(JsonPointer.parse('/foo/bar').toString()).toBe('/foo/bar');
        expect(JsonPointer.parse('/foo/~0').toString()).toBe('/foo/~0');
        expect(JsonPointer.parse('/foo/~1').toString()).toBe('/foo/~1');
    });

    it('can be serialized to JSON', () => {
        expect(JsonPointer.parse('/foo/bar').toJSON()).toBe('/foo/bar');
        expect(JsonPointer.parse('/foo/~0').toJSON()).toBe('/foo/~0');
        expect(JsonPointer.parse('/foo/~1').toJSON()).toBe('/foo/~1');
    });
});
