const {
  Tapable,
  SyncHook
} = require("tapable");

const path = require("path");
const _ = require("lodash");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CleanWebpackPlugin = require("clean-webpack-plugin");

const ExtractEmittedAssets = require("./plugins/extract-emitted-assets");
const SyncedFilesPlugin = require("./plugins/synced-files-plugin");

const directories = require("./utils/directories");
const pawConfig = require("./../config");

const serverRule = require("./inc/babel-server-rule");
const webRule = require("./inc/babel-web-rule");
const fontRule = require("./inc/babel-font-rule");
const srcSetRule = require("./inc/babel-srcset-rule");
const imageRule = require("./inc/babel-image-rule");
const resolverConfig =  require("./inc/webpack-resolver-config");
const cssRule = require("./inc/babel-css-rule");

let configEnvVars = {};
_.each(pawConfig, (value, key) => {
  configEnvVars[`__config_${key}`] = value;
});


module.exports = module.exports.default = class WebpackHandler extends Tapable {

  constructor(options) {
    super();
    this.hooks = {
      "init": new SyncHook(),
    };
    this.options = options;
    this.envConfigs = {
      "development": {
        web: [
          {
            name: "web",
            target: "web",
            mode: "development",
            devtool: "cheap-module-source-map",
            context: directories.root,
            entry: {
              client: [
                "@babel/polyfill",
                // Need react hot loader
                "react-hot-loader/patch",
                // Need webpack hot middleware
                "webpack-hot-middleware/client?name=web&path=/__hmr_update&timeout=2000&overlay=true&quiet=true",

                // Initial entry point for dev
                path.resolve(process.env.__lib_root, "./src/client/dev.js"),
              ],
            },
            output: {
              path: path.join(directories.dist, "build"),
              publicPath: "/build/",
              filename: "[hash].js",
              chunkFilename: "[chunkhash].js"
            },
            module: {
              rules: [
                webRule(),
                cssRule(),
                fontRule(),
                srcSetRule(),
                imageRule(),
              ]
            },
            ...resolverConfig,
            optimization: {
              splitChunks: {
                chunks: "all"
              }
            },
            plugins: [
              new webpack.EnvironmentPlugin(Object.assign({}, {
                "__project_root": process.env.__project_root,
                "__lib_root": process.env.__lib_root,
              })),
              new webpack.HotModuleReplacementPlugin(),
              new MiniCssExtractPlugin({
                // Options similar to the same options in webpackOptions.output
                // both options are optional
                filename: "[hash].css",
                chunkFilename: "[chunkhash].css"
              }),
              //new LodashModuleReplacementPlugin,
            ]
          }
        ],
        server: [
          {
            mode: "development",
            devtool: "cheap-module-source-map",
            target: "node",
            entry: path.resolve(process.env.__lib_root,"./src/server/common.js"),
            module: {
              rules: [
                serverRule({noChunk: true}),
                cssRule(),
                fontRule({emitFile: false, outputPath: "build/images/"}),
                srcSetRule(),
                imageRule({ emitFile: false, outputPath: "build/images/"}),
              ]
            },
            context: directories.root,
            devServer: {
              port: pawConfig.port,
              host: pawConfig.host,
              serverSideRender: pawConfig.serverSideRender,
            },
            optimization: {
              splitChunks: false
            },
            output: {
              filename: "server.js",
              publicPath: "/",
              path: directories.dist,
              library: "dev-server",
              libraryTarget: "umd"
            },
            externals: {
              express: "express"
            },
            ...resolverConfig,
            plugins: [
              new webpack.EnvironmentPlugin(Object.assign({}, {
                "__project_root": process.env.__project_root,
                "__lib_root": process.env.__lib_root,
              })),
              new MiniCssExtractPlugin({filename: "server.css"}),
            ]
          }
        ],
      },
      "production": {
        web: [
          {
            name: "web",
            target: "web",
            mode: "production",
            context: directories.root,
            entry: {
              client: [
                "@babel/polyfill",
                // Initial entry point for dev
                path.resolve(process.env.__lib_root, "./src/client/dev.js"),
              ],
            },
            output: {
              path: path.join(directories.dist, "build"),
              publicPath: "/build/",
              filename: "[hash].js",
              chunkFilename: "[chunkhash].js"
            },
            module: {
              rules: [
                webRule({cacheDirectory: true}),
                cssRule({
                  sourceMap: false,
                  localIdentName: "[hash:base64:5]",
                  compress: true,
                }),
                fontRule(),
                srcSetRule(),
                {
                  test: /\.(jpe?g|png|gif|svg|webp)$/i,
                  use: SyncedFilesPlugin.loader([
                    {
                      loader: "file-loader",
                      options: {
                        outputPath: "images/",
                        name: "[hash].[ext]",
                        context: directories.src,
                      }
                    }
                  ])
                }
              ]
            },
            ...resolverConfig,
            optimization: {
              splitChunks: {
                chunks: "all"
              }
            },
            plugins: [
              new webpack.EnvironmentPlugin(Object.assign({}, {
                "__project_root": process.env.__project_root,
                "__lib_root": process.env.__lib_root,
              })),
              new MiniCssExtractPlugin({
                // Options similar to the same options in webpackOptions.output
                // both options are optional
                filename: "[hash].css",
                chunkFilename: "[chunkhash].css"
              }),
              new CleanWebpackPlugin([
                directories.dist.split(path.sep).pop(),
              ], {
                root: path.dirname(directories.dist),
              }),
              new ExtractEmittedAssets({
                outputPath: directories.dist
              }),
              new SyncedFilesPlugin({
                outputPath: directories.dist
              })
            ]
          }
        ],
        server: [
          {
            mode: "production",
            target: "node",
            entry: path.resolve(process.env.__lib_root, "./src/server/prod.js"),
            module: {
              rules: [
                serverRule({noChunk: true, cacheDirectory: true}),
                cssRule({
                  sourceMap: false,
                  localIdentName: "[hash:base64:5]",
                  compress: true,
                }),
                fontRule({emitFile: false, outputPath: "build/fonts/"}),
                srcSetRule(),
                {
                  test: /\.(jpe?g|png|gif|svg|webp)$/i,
                  use: SyncedFilesPlugin.loader([
                    {
                      loader: "file-loader",
                      options: {
                        outputPath: "build/images/",
                        name: "[hash].[ext]",
                        context: directories.src,
                      }
                    }
                  ])
                },
              ]
            },
            context: directories.root,
            devServer: {
              port: pawConfig.port,
              host: pawConfig.host,
              serverSideRender: pawConfig.serverSideRender,
            },
            optimization: {
              splitChunks: false
            },
            output: {
              filename: "server.js",
              publicPath: "/",
              path: directories.dist,
              library: "dev-server",
              libraryTarget: "umd"
            },
            stats: {
              warnings: false
            },
            externals: {
              "pwa-assets": "./assets.json",
            },
            ...resolverConfig,
            plugins: [
              new webpack.EnvironmentPlugin(Object.assign({}, {
                "__project_root": process.env.__project_root,
                "__lib_root": process.env.__lib_root,
              }, configEnvVars)),
              new MiniCssExtractPlugin({filename: "server.css"}),
              new SyncedFilesPlugin({
                deleteAfterCompile: true,
                outputPath: directories.dist
              })
            ]
          }
        ],
      },
    };
  }

  getConfig(env = "development", type = "web") {
    if (this.envConfigs[env] && this.envConfigs[env][type]) {
      return this.envConfigs[env][type];
    }
    throw new Error(`Cannot find appropriate config for environment ${env} & type ${type}`);
  }

};