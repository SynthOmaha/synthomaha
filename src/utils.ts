import blobshape from 'blobshape'
import {
    adjectives,
    animals,
    uniqueNamesGenerator,
} from 'unique-names-generator'

export function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export function uniqueName() {
    const config = {
        dictionaries: [adjectives, animals],
        separator: '-',
        length: 2,
    }
    return `${uniqueNamesGenerator(config)}-${randomInt(100, 999)}`
}

/**
 * Overrides accepted by `generateBlob`. Mirrors the parameters understood by
 * `blobshape` (so the merged value stays type-safe when forwarded) and adds the
 * `name` / `colors` fields that `generateBlob` tracks for its return value.
 */
type BlobParameters = NonNullable<Parameters<typeof blobshape>[0]> & {
    name?: string
    colors?: [string, string]
}

export function generateBlob(parameters?: BlobParameters) {
    const gradientColors: [string, string][] = [
        ['#2E3192', '#1BFFFF'],
        ['#93A5CF', '#E4EfE9'],
        ['#BFF098', '#6FD6FF'],
        ['#A1C4FD', '#C2E9FB'],
        ['#11998E', '#38EF7D'],
        ['#D8B5FF', '#1EAE98'],
    ]

    parameters = {
        seed: null,
        size: 512,
        edges: randomInt(3, 20),
        growth: randomInt(2, 9),
        name: uniqueName(),
        colors: gradientColors[randomInt(0, gradientColors.length - 1)],
        ...parameters,
    }
    const { path: svgPath, seedValue: seed } = blobshape(parameters)
    return { parameters: { ...parameters, seed }, svgPath }
}

export const uploadDisabled =
    import.meta.env.PUBLIC_DISABLE_UPLOADS?.toLowerCase() === 'true'
