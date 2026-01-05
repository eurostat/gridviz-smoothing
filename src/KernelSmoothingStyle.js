//@ts-check
'use strict'

import { Style } from 'gridviz'
import { density2d } from 'fast-kde'
import { extent } from 'd3-array'

/**
 * A style representing the cell as a smoothed layer, to smoothing local variations and show main trends across space.
 *
 * @author Julien Gaffuri
 */
export class KernelSmoothingStyle extends Style {
    // https://observablehq.com/d/5dd1cb5e4d21c021
    // https://observablehq.com/@uwdata/fast-kde
    // https://observablehq.com/d/3127b6d89ada959f
    //TODO https://observablehq.com/@sahilchinoy/areal-interpolation-iii ?

    /** @param {object} opts */
    constructor(opts) {
        super(opts)
        opts = opts || {}

        /** A function returning the value to consider for each cell. This is the value to be smoothed.
         */
        this.value = opts.value

        /** The smoothing parameter, in geo unit. The larger, the more smoothed.
         * @type {function(number,number):number}
         */
        this.sigma = opts.sigma // (r, z)=>...

        /** A factor to adjust the smoothed grid resolution.
         * When set to 1, the smoothed grid is exactly the screen resolution.
         * Set to 2 to degrade the resolution to a factor 2.
         * The higher, the more pixelised and the faster to compute.
         * @deprecated Use resolutionSmoothed instead
         * @type { number }
         */
        this.factor = opts.factor || 2

        /**
         * The resolution of the smoothed grid.
         */
        this.resolutionSmoothed = opts.resolutionSmoothed //|| ((r, z) => r)

        /** A filter function to filter the smoothed cells based on their smoothed value.
         *  Return true to keep the cell, false otherwise.
         * @type { function(number):boolean }
         */
        this.filterSmoothed = opts.filterSmoothed

        /** The name of the cell property where the smoothed value is stored in the output smoothed grid.
         * @type { string }
         */
        this.smoothedProperty = opts.smoothedProperty || 'ksmval'

        /** The styles to represent the smoothed grid.
         * @type {Array.<Style>}
         */
        this.styles = opts.styles || []
    }

    /**
      * Draw the smoothed cells depending on the list of styles specified.
      * @param {Array.<Cell>} cells
      * @param {GeoCanvas} geoCanvas
      * @param {number} resolution
      * @override
      */
    draw(cells, geoCanvas, resolution) {

        //filter
        if (this.filter) cells = cells.filter(this.filter)

        if (!cells || cells.length == 0) return

        //
        const z = geoCanvas.view.z

        //get smoothing param in geo unit
        /** @type {number} */
        const sG = this.sigma(resolution, z)

        //get resolution of the smoothed grid
        /** @type {number} */
        let resSmoothed
        if (this.resolutionSmoothed) resSmoothed = this.resolutionSmoothed(resolution, z)
        else resSmoothed = +(this.factor * z).toFixed(5)

        //get min max x,y
        const xMin = Math.floor(geoCanvas.extGeo.xMin / resolution) * resolution
        const xMax = Math.ceil(geoCanvas.extGeo.xMax / resolution) * resolution
        const yMin = Math.floor(geoCanvas.extGeo.yMin / resolution) * resolution
        const yMax = Math.ceil(geoCanvas.extGeo.yMax / resolution) * resolution

        //compute smoothed grid dimensions
        const nbX = Math.ceil((xMax - xMin) / resSmoothed)
        const nbY = Math.ceil((yMax - yMin) / resSmoothed)

        //compute smoothed grid
        let g = density2d(cells, {
            x: (c) => c.x + resolution / 2,
            y: (c) => c.y + resolution / 2,
            weight: (c) => this.value(c),
            bins: [nbX, nbY],
            bandwidth: sG,
            extent: [[xMin, xMin + nbX * resSmoothed], [yMin, yMin + nbY * resSmoothed]],
        }).grid()

        //make smoothed cells
        cells = []
        for (let ind = 0; ind < g.length; ind++) {
            const v = g[ind]
            if (this.filterSmoothed && !this.filterSmoothed(v)) continue
            const row = Math.floor(ind / nbX)
            const col = ind % nbX
            const x = xMin + col * resSmoothed
            const y = yMin + row * resSmoothed
            //console.log(resSmoothed,x,y)
            const c = { x: x, y: y }
            c[this.smoothedProperty] = v
            cells.push(c)
        }

        //draw smoothed cells from styles
        const ctx = geoCanvas.offscreenCtx
        for (let s of this.styles) {

            //check if style is visible
            if (s.visible && !s.visible(z)) continue

            //set style alpha and blend mode
            //TODO: multiply by layer alpha ?
            if (s.alpha || s.blendOperation) {
                ctx.save()
                if (s.alpha) ctx.globalAlpha = s.alpha(z)
                if (s.blendOperation) ctx.globalCompositeOperation = s.blendOperation(z)
            }

            //set affin transform to draw with geographical coordinates
            geoCanvas.setCanvasTransform()

            //draw with style
            s.draw(cells, geoCanvas, resSmoothed)

            //draw style filter
            if (s.filterColor) s.drawFilter(geoCanvas)

            //restore ctx
            if (s.alpha || s.blendOperation) ctx.restore()
        }

        //update legends
        //TODO
        //for (let s of this.styles)
        //    s.updateLegends({ style: s, r: r, zf: cg.getZf() });
    }
}
