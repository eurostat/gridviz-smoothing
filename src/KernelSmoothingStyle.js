//@ts-check
'use strict'

import { Style } from 'gridviz'
import { density2d } from 'fast-kde'

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
        this.sigma = opts.sigma // (r, zf)=>...

        /** A factor to adjust the smoothed grid resolution.
         * When set to 1, the smoothed grid is exactly the screen resolution.
         * Set to 2 to degrade the resolution to a factor 2.
         * The higher, the more pixelised and the faster to compute.
         * @type { number }
         */
        this.factor = opts.factor || 2

        /** A filter function to filter the smoothed cells based on their smoothed value.
         *  Return true to keep the cell, false otherwise.
         * @type { function(number):boolean }
         */
        this.filterSm = opts.filterSm

        /** The name of the attribute where the smoothed value is stored in the output smoothed grid.
         * @type { string }
         */
        this.sCol = opts.sCol || 'ksmval'

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

        //get smoothing param in geo unit
        /** @type {number} */
        const sG = this.sigma(resolution, geoCanvas.zf)

        //compute smoothed grid dimensions
        const nbX = Math.ceil(geoCanvas.w / this.factor)
        const nbY = Math.ceil(geoCanvas.h / this.factor)
        //compute smoothed grid geo extent
        const e_ = [
            [geoCanvas.pixToGeoX(0), geoCanvas.pixToGeoX(nbX * this.factor)],
            [geoCanvas.pixToGeoY(nbY * this.factor), geoCanvas.pixToGeoY(0)],
        ]

        //compute smoothed grid
        let g = density2d(cells, {
            x: (c) => c.x + resolution / 2,
            y: (c) => c.y + resolution / 2,
            weight: (c) => this.value(c),
            bins: [nbX, nbY],
            bandwidth: sG,
            extent: e_,
        }).grid()

        //compute the resolution of the smoothed grid
        const resSmoothed = (e_[0][1] - e_[0][0]) / nbX

        //make smoothed cells
        cells = []
        for (let ind = 0; ind < g.length; ind++) {
            const v = g[ind]
            if (this.filterSm && !this.filterSm(v)) continue
            const row = Math.floor(ind / nbX)
            const col = ind % nbX
            const c = { x: e_[0][0] + col * resSmoothed, y: e_[1][0] + row * resSmoothed }
            c[this.sCol] = v
            cells.push(c)
        }

        //draw smoothed cells from styles
        for (let s of this.styles) {
            geoCanvas.ctx.globalAlpha = s.alpha ? s.alpha(geoCanvas.zf) : 1.0
            geoCanvas.ctx.globalCompositeOperation = s.blendOperation(geoCanvas.zf)

            s.draw(cells, resSmoothed, geoCanvas)
        }

        //update legends
        //for (let s of this.styles)
        //    s.updateLegends({ style: s, r: r, zf: cg.getZf() });
    }
}
