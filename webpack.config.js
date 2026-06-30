const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      'detect-node': path.resolve(__dirname, 'src/detect-node-browser.js')
    },
    // 提供空模块作为 Node.js 内置模块的 fallback
    fallback: {
      'node:path': false,
      'node:process': false,
      'node:fs': false,
      'node:crypto': false,
      'node:stream': false,
      'node:util': false,
      'node:buffer': false,
      'node:events': false,
      'path': false,
      'process': false,
      'fs': false,
      'crypto': false,
      'stream': false,
      'util': false,
      'buffer': false,
      'events': false
    }
  },
  target: ['web', 'electron-renderer'],
  plugins: [
    new webpack.DefinePlugin({
      'global': 'globalThis',
      'process.browser': true,
      'typeof process': '"object"'
    })
  ]
};