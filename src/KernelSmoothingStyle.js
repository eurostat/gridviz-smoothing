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
         * @type { number }
         */
        //this.factor = opts.factor || 2

        /**
         * The resolution of the smoothed grid.
         */
        this.resolutionSmoothed = opts.resolutionSmoothed || ((r, z) => r / 2)

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
        const rs = this.resolutionSmoothed(resolution, z)

        //get min max x,y
        const [minx, maxx] = extent(cells, c => c.x)
        const [miny, maxy] = extent(cells, c => c.y)

        //compute smoothed grid dimensions
        //TODO ceil ? why not floor ?
        //const nbX = Math.ceil(geoCanvas.w / this.factor)
        //const nbY = Math.ceil(geoCanvas.h / this.factor)
        const nbX = Math.ceil((maxx - minx) / rs)
        const nbY = Math.ceil((maxy - miny) / rs)

        //compute smoothed grid geo extent
        const e_ = [
            //[geoCanvas.pixToGeoX(0), geoCanvas.pixToGeoX(nbX * this.factor)],
            [minx, minx + nbX * rs],
            //[geoCanvas.pixToGeoY(nbY * this.factor), geoCanvas.pixToGeoY(0)],
            [miny, miny + nbY * rs],
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
        //const resSmoothed = (e_[0][1] - e_[0][0]) / nbX
        //const resSmoothed = z * this.factor
        const resSmoothed = rs

        //make smoothed cells
        cells = []
        for (let ind = 0; ind < g.length; ind++) {
            const v = g[ind]
            if (this.filterSmoothed && !this.filterSmoothed(v)) continue
            const row = Math.floor(ind / nbX)
            const col = ind % nbX
            const x = e_[0][0] + col * resSmoothed
            const y = e_[1][0] + row * resSmoothed
            const c = { x: x, y: y }
            c[this.smoothedProperty] = v
            cells.push(c)
        }

        //draw smoothed cells from styles
        for (let s of this.styles) {
            geoCanvas.ctx.globalAlpha = s.alpha ? s.alpha(z) : 1.0
            geoCanvas.ctx.globalCompositeOperation = s.blendOperation(z)

            s.draw(cells, geoCanvas, resSmoothed)
        }

        //update legends
        //for (let s of this.styles)
        //    s.updateLegends({ style: s, r: r, zf: cg.getZf() });
    }
}
