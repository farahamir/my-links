const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = {
    entry: {
        index: "./MyThing.js",
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
    },
    resolve: {
        extensions: [".js", ".jsx"],
    },
    module: {
        rules: [
            {
                test: /\.js$|jsx/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env", "@babel/preset-react"],
                    },
                },
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./index.html",
            filename: "index.html",
        }),
        new CopyPlugin({
            patterns: [
                { from: "./images", to: "images" },
                { from: "./img", to: "img" },
                { from: "./background.js" },
                { from: "./jquery.min.js" },
                { from: "./manifest.json" },
                { from: "./MyThing.css" },
                { from: "./MyThing.js" },
                { from: "./MyThings.json" },
                { from: "./options.css" },
                { from: "./options.html" },
                { from: "./options.js" }
            ],
        }),
        new ZipPlugin({
            filename: 'visualinks.zip',
            path: path.resolve(__dirname),
            include: [
                'images',
                'img',
                'background.js',
                'index.html',
                'jquery.min.js',
                'manifest.json',
                'MyThing.css',
                'MyThing.js',
                'MyThings.json',
                'options.css',
                'options.html',
                'options.js'
            ]
        }),
    ],
};