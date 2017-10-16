const webpack = require('webpack')

module.exports = {
    context: __dirname + '/app',
    devtool: 'inline-source-map',
    watch: true,
    entry: {
        app: './index.ts',
    },
    output: {
        path: __dirname + '/build',
        filename: 'bundle.js',
    },
    devServer: {
        contentBase: './app',
        hot: true,
    },
    module: {

        rules: [{
            test: /\.tsx?$/,
            exclude: /node_modules/,
            loader: 'ts-loader',
            options: {
                configFile: 'tsconfig.json',
            },
        }],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
    ],
}
