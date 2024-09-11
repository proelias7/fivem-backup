const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: './app.js',
    output: {
        path: path.resolve(__dirname, 'Q_backup'),
        filename: 'app.js',
    },
    plugins: [
        new webpack.DefinePlugin({
            "global.GENTLY": false
        }),
    ],
    optimization: {
        minimize: true, 
    },
    resolve: {
        extensions: ['.js'], 
        preferRelative: true
    },
    target: 'node',
};
