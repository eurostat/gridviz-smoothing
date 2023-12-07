// dev
const LiveReloadPlugin = require('webpack-livereload-plugin')

module.exports = {
    mode: 'development',
    output: {
        filename: 'gridviz-smoothing.js',
        library: 'gridviz_smoothing',
        libraryTarget: 'umd',
    },
    plugins: [new LiveReloadPlugin()],
    watch: true,
    devtool: 'inline-source-map',

    experiments: {
        asyncWebAssembly: true,
        //syncWebAssembly: true
    },
}
