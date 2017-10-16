type Callable<T> = (...args: T[]) => any

interface ImageDimensions {
    width: number,
    height: number,
}

interface CanvasImageData {
    width: number,
    height: number,
    data: Uint8ClampedArray,
}

interface PixelValue {
    index: number,
    luminance: number,
    luminanceScale: number,
    value: Uint8ClampedArray,
}

interface PixelPositions {
    TOP: 'TOP',
    RIGHT: 'RIGHT',
    BOTTOM: 'BOTTOM',
    LEFT: 'LEFT',
}

// https://gist.github.com/paulirish/1579671
const rafPolyfill = (() => {
    let clock = Date.now()

    return (callback?: Callable<FrameRequestCallback | number>) => {
        const currentTime = Date.now()

        if (currentTime - clock > 16) {
            clock = currentTime
            callback(currentTime)
        } else {
            setTimeout(() => {
                rafPolyfill(callback)
            }, 0)
        }
    }
})()

const requestAnim = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    (<any>window).mozRequestAnimationFrame ||
    rafPolyfill

interface DecompositionInterface {
    readonly image: HTMLImageElement
    readonly imageSrc: string
    readonly imageDimensions: ImageDimensions
    readonly canvas: HTMLCanvasElement
    readonly ctx: CanvasRenderingContext2D
    readonly imageData: CanvasImageData
    readonly decay: number
    readonly decayThreshhold: number
    readonly positions: PixelPositions
}

class Decomposition implements DecompositionInterface {
    readonly image: HTMLImageElement
    readonly imageSrc: string
    readonly imageDimensions: ImageDimensions
    readonly canvas: HTMLCanvasElement
    readonly ctx: CanvasRenderingContext2D
    readonly imageData: CanvasImageData
    readonly decay: number
    readonly decayThreshhold: number
    readonly positions: PixelPositions = {
        TOP: 'TOP',
        RIGHT: 'RIGHT',
        BOTTOM: 'BOTTOM',
        LEFT: 'LEFT',
    }


    public constructor() {
        // this.imageSrc = './square.jpg'
        this.imageSrc = './horse.jpg'
        this.imageDimensions = { width: 0, height: 0 }
        this.decay = 5
        this.decayThreshhold = 0.5

        this.canvas = document.createElement('canvas')
        this.ctx = this.canvas.getContext('2d')

        this.setCanvasProperties()

        this.image = new Image()
        this.image.onload = () => this.onImageLoadSuccess()
        this.image.onerror = err => this.onImageLoadError(err)

        this.image.src = this.imageSrc
    }

    protected setCanvasProperties(): void {
        // this.ctx.imageSmoothingEnabled = false
    }

    protected createCanvas<T>(callback?: Callable<T>): void {
        const { width, height } = this.imageDimensions

        this.canvas.width = width
        this.canvas.height = height

        document.body.appendChild(this.canvas)

        // load image in canvas
        this.ctx.drawImage(this.image, 0, 0, width, height)

        if (callback && typeof callback === 'function') {
            callback.call(this)
        }

    }

    public getImageData(): CanvasImageData {
        const { width, height } = this.imageDimensions
        return this.ctx.getImageData(0, 0, width, height)
    }

    protected onImageLoadSuccess(): void {
        this.imageDimensions.width = this.image.naturalWidth
        this.imageDimensions.height = this.image.naturalHeight
        this.createCanvas(this.render)
    }

    public onImageLoadError(err: ErrorEvent): void {
        throw err
    }

    public getLuminanceScale(r: number, g: number, b: number): number {
        return this.getLuminance(r, b, g) / 255
    }

    public getLuminance(r: number, g: number, b: number): number {
        return (r + r + b + g + g + g) / 6
    }

    public pixelValue(index: number, imageData: CanvasImageData): PixelValue {
        const r = imageData.data[index]
        const g = imageData.data[index + 1]
        const b = imageData.data[index + 2]
        const a = imageData.data[index + 3]

        const value: Uint8ClampedArray = new Uint8ClampedArray([r, g, b, a])
        const luminance = this.getLuminance(r, g, b)
        const luminanceScale = this.getLuminanceScale(r, g, b)

        return { index, luminance, luminanceScale, value }
    }

    public decayPixel(index: number, imageData: CanvasImageData, decayFactor: number = 1, force: boolean = false): PixelValue {
        const pixel = this.pixelValue(index, imageData)
        const updateValues = ((pixel.luminanceScale > this.decayThreshhold && pixel.luminanceScale < 1) || force)

        if (updateValues && index > -1 && index <= imageData.data.length) {
            const r = pixel.value[0] + Math.floor(this.decay * decayFactor)
            const g = pixel.value[1] + Math.floor(this.decay * decayFactor)
            const b = pixel.value[2] + Math.floor(this.decay * decayFactor)
            const a = pixel.value[3]

            imageData.data.set([r, g, b, a], index)
        }

        return pixel
    }

    public getSiblingIndex(fromIndex: number, position: string): number {
        let index: number = -1
        const calculatedWidth: number = this.imageDimensions.width * 4

        switch (position) {
            case this.positions.TOP:
                index = fromIndex - calculatedWidth
                break;

            case this.positions.RIGHT:
                index = fromIndex + 4
                break;

            case this.positions.BOTTOM:
                index = fromIndex + calculatedWidth
                break;

            case this.positions.LEFT:
                index = fromIndex - 4
                break;

            default:
                break;
        }

        index = index < 0 ? -1 : index
        return index
    }

    public decaySiblings(index: number, imageData: CanvasImageData): PixelValue[] {
        const indexT = this.getSiblingIndex(index, this.positions.TOP)
        const indexR = this.getSiblingIndex(index, this.positions.RIGHT)
        const indexB = this.getSiblingIndex(index, this.positions.BOTTOM)
        const indexL = this.getSiblingIndex(index, this.positions.LEFT)

        const pixelT = this.decayPixel(indexT, imageData, 0.5, true)
        const pixelR = this.decayPixel(indexR, imageData, 0.5, true)
        const pixelB = this.decayPixel(indexB, imageData, 0.5, true)
        const pixelL = this.decayPixel(indexL, imageData, 0.5, true)

        return [pixelT, pixelR, pixelB, pixelL]
    }

    public createImage(): CanvasImageData {
        const imageData: CanvasImageData = this.getImageData()

        for (var i = 0; i < imageData.data.length; i += 4) {
            const { luminance, luminanceScale } = this.decayPixel(i, imageData)

            // decay the sibling pixels to the top, right, bottom, left, if the current pixel is decaying
            if (luminanceScale > this.decayThreshhold && luminanceScale < 1) {
                this.decaySiblings(i, imageData)
            }
        }

        return imageData
    }

    public render(): void {
        this.ctx.putImageData(this.createImage(), 0, 0)
        requestAnim.call(window, this.render.bind(this))
    }

}

window.onload = () => new Decomposition()
