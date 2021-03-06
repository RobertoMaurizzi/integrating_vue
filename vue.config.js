// vue.config.js
const path = require("path");

module.exports = {
    pages: {
        app_one: {
            // entry for the page
            entry: 'app_one/frontend/one_main.js',
            // the source template
            template: 'app_one/frontend/one_index.html',
            // output as dist/index.html
            filename: '../app_one/templates/app_one/ejs_index.html',
            // when using title option,
            // template title tag needs to be <title><%= htmlWebpackPlugin.options.title %></title>
            title: 'App One Index Page',
            // chunks to include on this page, by default includes
            // extracted common chunks and vendor chunks.
            chunks: ['chunk-vendors', 'chunk-common', 'index']
        },
        app_two: {
            // entry for the page
            entry: 'app_two/frontend/two_main.js',
            // the source template
            template: 'app_two/frontend/two_index.html',
            // output as dist/index.html
            filename: '../app_two/templates/app_two/ejs_index.html',
            // when using title option,
            // template title tag needs to be <title><%= htmlWebpackPlugin.options.title %></title>
            title: 'App Two Index Page',
            // chunks to include on this page, by default includes
            // extracted common chunks and vendor chunks.
            chunks: ['chunk-vendors', 'chunk-common', 'index']
        },
    },
    devServer: {
        port: 8081,
        writeToDisk: true,
        overlay: {
            warnings: true,
            errors: true
        },
    },
    chainWebpack: config => {
        config
            .plugin('html-app_one')
            .tap(args => {
                args[0].inject = false
                args[0].chunks.push('app_one')
                return args
            });
        config
            .plugin('html-app_two')
            .tap(args => {
                args[0].inject = false
                args[0].chunks.push('app_two')
                return args
            });
        // add aliases for importing modules from @app_one/components or @app_two/components
        config.resolve.alias.set('@app_one', path.join(__dirname, 'app_one/frontend'));
        config.resolve.alias.set('@app_two', path.join(__dirname, 'app_two/frontend'));
    },
    outputDir: './dist',
    assetsDir: "static",
}
