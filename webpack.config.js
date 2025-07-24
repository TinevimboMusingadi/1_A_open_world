import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/client/index.js',
    
    output: {
      path: path.resolve(__dirname, 'src/client/dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
      publicPath: '/'
    },
    
    mode: isProduction ? 'production' : 'development',
    
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    
    resolve: {
      extensions: ['.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src/client'),
        '@engine': path.resolve(__dirname, 'src/engine'),
        '@llm': path.resolve(__dirname, 'src/llm')
      }
    },
    
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    browsers: ['last 2 versions']
                  }
                }],
                ['@babel/preset-react', {
                  runtime: 'automatic'
                }]
              ],
              plugins: [
                '@babel/plugin-proposal-class-properties'
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource'
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource'
        }
      ]
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/client/public/index.html',
        favicon: './src/client/public/favicon.ico',
        title: 'Dynamic Game Engine - LLM Powered',
        meta: {
          description: 'A dynamic game engine that uses LLM to modify gameplay in real-time',
          viewport: 'width=device-width, initial-scale=1'
        }
      })
    ],
    
    devServer: {
      static: {
        directory: path.join(__dirname, 'src/client/dist'),
      },
      compress: true,
      port: 8080,
      hot: true,
      historyApiFallback: true,
      proxy: {
        '/api': 'http://localhost:3000',
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true
        }
      },
      client: {
        overlay: {
          errors: true,
          warnings: false
        }
      }
    },
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000
    }
  };
}; 