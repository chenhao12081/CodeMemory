# 1. webpack简介

## 什么是webpack & 打包

webpack是一个开源的**Javascript模块**打包工具，其核心功能是根据**模块之间的依赖**，把多个模块按照**特定的规则和顺序组织**在一起，最终合并成一个JS文件。

## 模块化思想

在设计程序的时候，不将所有代码累积在一起，而是按照功能拆分成代码块，每个代码块实现一个功能，最终通过接口将他们组合在一起。这是基本的模块化思想。

## 模块打包工具的作用

模块打包工具主要是要解决模块之间的依赖，将模块按照一定的规则和组织方式打包成一个js包，并且其能运行在浏览器上。所以他的工作方式有两种:

+ 将存在依赖关系的模块按照特定规则合并成单个JS文件，一次全部加载进页面中
+ 在页面初始化时只加载一个入口模块，异步加载其他模块

## webpack环境配置和基本使用

webpack唯一的依赖就是Node.js，只要环境中有Node即可。

1. 初始化项目```npm init -y```
2. 安装webpack和webpack-cli。```npm install webpack webpack-cli -D```。webpack是核心模块，webpack-cli是命令行工具。
3. 执行命令```npx webpack -v``` ```npx webpack-cli -v ```查看版本号，来证明安装成功
4. 构建项目，添加文件如下

```js
// index.js
import addContent from './add-content.js'
document.write('My first Webpack app.<br />')

addContent()
```

```js
// add-content.js
export default function() {
  document.write('Hello World!')
}
```

```html
// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./dist/main.js"></script>
</body>
</html>
```

5. 控制台执行命令```npx webpack --entry=./index.js --mode=development```

![image-20240930111222074](image/image-20240930111222074.png)

![image-20240930112851032](image/image-20240930112851032.png)

##  npm scripts

scripts是npm提供的脚本命令功能，在这里我们直接使用由模块添加的指令。

```js
{
  "name": "first",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "webpack --entry=./index.js --mode=development"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "webpack": "^5.95.0",
    "webpack-cli": "^5.1.4"
  }
}
```

## 默认配置

打包文件输出默认是在dist文件夹下，而入口文件默认是src/index.js

## webpack配置

webpack命令可以添加非常多的参数，其可通过```npx webpack -h``查看。通过添加命令可以实现不同的功能，其有默认的配置文件webpack.config.js，可以在其中配置。

1. 在项目中创建webpack.config.js文件
2. 增加入口文件、输出文件名称和模式

```js
module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "main.js",
  },
  mode: "development",
};
```

3. 去掉package.json里的参数

```js
script: {
    "build": "webpack"
}
```

## webpack-dev-server

单纯使用webpack开发效率并不高，相比以前修改html、css、js，刷新页面即可看到更新效果，但现在多了一步打包，要使用webpack命令打包后更新bundle.js文件。但webpack为我们提供了一个便捷的本地化开发工具，webpack-dev-server。

1. ```npm i webpack-dev-server -D```

添加-D命令因为仅仅在开发环境中需要webpack-dev-server，在生产环境中并不需要。**-D命令安装会将webpack-dev-server作为工程的devDependencies(开发环境依赖)记录在package.json中，在项目上线要安装依赖时，就可以通过npm install --only=prod过滤掉开发环境依赖中的冗余模块，从而加快安装和发布的速度。**

2. **为了更加便捷地启动```webpack-dev-server```，可在在package.json里添加一个dev命令。**

```javascript
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "webpack",
    "dev": "webpack serve"
  },
```

3. **将原本在src目录下的index.html复制到dist文件夹下，作为在webpack-dev-server启动后，作为本地服务请求的html文件。**

4. **在webpack.config.js文件中，配置webpack-dev-server**

```js
  devServer: {
    static: '/dist'
  }
```

![image-20241002204409042](image/image-20241002204409042.png)

```html
// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./main.js"></script>
</body>
</html>
```

### webpack-dev-server的作用

**webpack-dev-server可以看做是一个服务者，其首先作用是接受浏览器的资源请求，然后返回结果。在启动webpack-dev-server后，他会打包资源，打包结果并不会实际存在dist文件夹下，而是存在内存中，这个可以通过删掉dist文件夹下的打包文件验证。然后，会验证浏览器的url请求，如果是资源服务地址，则会从配置的static地址去寻找资源并返回给浏览器，如果请求地址不属于资源服务地址，则直接读取硬盘中的源文件并返回。**

+ webpack会进行资源打包，并处理打包结果的请求
+ webpack会处理静态资源文件请求

webpack还有一个重要的特性，live-reloading。当服务和浏览器都处于打开的状态时，我们修改文件，浏览器的内容会自动更新。

# 2. 模块

## 加载npm模块

npm作为包管理器，可以让开发者在平台上找到由其他开发和发布的库，从而快速解决问题。

npm和yarn作为Javascript的两个主流包管理器，其仓库是共通的。

本地化工程加载和安装一个外部npm模块的步骤如下：

1. 初始化一个npm工程，通过npm获得模块，以loadsh为例。

```npm init -y```

```npm install loadsh```

执行上述命令后，npm会将loadsh安装在工程的node_modules目录下，并将对该模块的依赖信息记录在package.json里

2. 加载一个模块只需要引入包的名字即可

```import _ from 'loadsh'```



==在导入一个npm模块时，只需要写明他的名字即可，但当打包时其具体加载的是哪个JS文件？==

每个npm模块都有一个入口。当我们加载一个模块的时候就是加载这个模块的入口文件。这个入口被维护在模块内部的package.json文件的main字段中。

```javascript
// ./node_modules/underscore/package.json
{
    "name": "loadsh",
        ......
    "main": "loadsh.js"
}
```

当加载该模块时，实际加载的是node_modules/loadsh/index.js

**除了直接加载模块以为，也可以通过```<pack_name>/<path>```的形式单独加载模块内部的某个js文件。**

```js
import all from 'loadsh/fp/all.js';
console.log('all', all)
```

这样webpack最终只会加载all.js这个文件，而不会打包整个loadsh库，进而减小打包资源的体积。

## 模块打包原理

```js
// index.js
const calculator = require('./calculator.js')
const sum = calculator.add(2,3)
console.log('sum', sum)

// calculator.js
module.exports = {
    add: (a, b) => a + b;
}
```

上面代码经过打包之后 会成为如下形式

```js
// bundle.js

// 立即执行函数
(function(modules) {
    // 模块缓存
    var installedModules = {};
    // 实现require
    function __webpack__require__(moduleId) {
        ...
    }
    // 执行入口模块的加载
    return __weback__require__(__webpack_require__.s = 0);
})
({
    // modules: 以key-value的形式存储所有被打包的模块
    0: function(module, exports, __webpack_require__) {
        // 打包入口
        module.exports = __webpack_require__('3qiv');
    },
    '3qiv'：function(module, exports, __webpack_require__) {
       	// index.js内容
    },
    jkzz: function(module, exports) {
        // calculator.js内容
    }
})
```

这是一个最简单的webpack打包结果（bundle），但已经可以清晰地展示出他是如何将具有依赖关系的模块串联在一起。上面的bundle分为以下几个部分：

+ 最外层的匿名函数，用来包裹真个bundle，形成自身的作用域，实现打包的模块按照顺序引入
+ installedModules对象。每个模块只有第一次加载时候执行，之后其导出值记录在installedModules对象中，当被再次加载时，webpack会直接从这里取值，而不会重新执行该模块。
+ ```__webpack_require__```函数实现模块的加载，**浏览器中可以调用```__webpack_require__```来实现模块的导入**。
+ modules对象，工程化所有产生了依赖关系的模块都会以key-value的形式保存在这里，其中value是由匿名函数包裹的的模块实体。匿名函数的参数赋予了模块导入导出的能力。

### bundle在浏览器中执行过程

1. 在最初匿名函数初始化浏览器执行环境，包括定义```installedModules```，```__webpack__require__```函数等，文日模块的加载和执行做一些准备工作。
2. 加载入口模块。
3. 执行模块代码，如果执行到了module.exports则记录下模块的导出值。如果中间遇到了require函数（```__webpack__require__```），则会暂时交出执行权，进入```__webpack__require__```函数体内进行加载其他模块的逻辑。
4. 在```__webpack__require__```中判断即将加载的模块是否存在于```installedModules```中，如果存在则直接取值，否则回到第三步，执行该模块的代码来获取导出值。
5. 所有的依赖模块都已执行完毕，最后执行权又回到入口模块。当入口模块的代码执行完毕，也就意味着整个模块执行完毕、



==以下面例子为例==

```js
// index.js
const calculator = require('./calculator.js')
const sum = calculator.add(2,3)
console.log('sum', sum)

// calculator.js
module.exports = {
    add: (a, b) => a + b;
}
```

其被webpack打包后形成了bundle.js文件，引入到html后，在浏览器中运行的过程如下：

1. 引入bundle.js后，bundle.js自执行文件，首先初始化环境，如记录已执行模块的对象和模块引入函数。
2. 然后执行入口模块index.js的加载，其记录在参数里modules对象 ，执行入口文件，遇到了```const calculator = require('./calculator.js')```，则交出执行权，进入```__webpack__require__```函数内部执行代码，如果calculator.js没有加载记录，执行calculator.js文件，获取其导出值，再回到index.js继续执行，用calculator.js的导出值继续执行，直到index.js执行完毕。

# 3. 资源的输入输出

webpack的模块打包可以理解为工程的打包将一个一个的零部件组成最终的产品，而资源的输入和输出则是解决产品原材料从哪来，和产品到哪去。

## chunk bundle

webpack从入口文件开始检索，将具有依赖关系的模块最终形成一颗依赖树，最终得到一个chunk，一般将由chunk得到的打包产物称为bundle。

在某些特殊情况下，一个入口文件也能产生多个chunk，最终形成多个bundle。

## 配置资源入口

webpack通过context和entry两个配置项来共通决定入口文件的位置。配置入口文件主要有两个作用

+ 确定入口文件的位置。
+ 如果只有一个入口，那么chunk名字默认是main。如果有多个入口，多个chunk，那么需要为每个入口配置名字，来做为chunk的唯一标识。

### context

配置入口资源的前缀，必须是绝对路径，使用context的初衷是让entry的编写更加便洁。

```javascript
const path =  require('path')

module.exports = {
  context: path.join(__dirname, './src'),
  entry: "./index.js",
  output: {
    filename: "main.js",
  },
  mode: "development",
  devServer: {
    static: './dist'
  }
};
```

![1728107104080](image/1728107104080.png)

### entry

entry的配置方式有多种，字符串、数组、对象、函数。

#### 字符串

```js
module.exports = {
    entry: './src/index.js',
}
```

#### 数组

数组会取最后一个元素作为入口，前面的元素会将多个资源预先合并。

```javascript
module.exports = {
    entry: ['babel-polyfill', './src/index/js']
}
```

上面的配置相当于

```js
// index.js
import 'babel-polyfill'

// webpack.config.js
module.exports = {
    entry: './src/index.js'
}
```

#### 对象类型入口

如果想要定义多个入口或者定义chunk的名字，则使用对象定义entry

```js
module.exports = {
    entry: {
        // chunk 名字为 lib 入口文件为lib.js文件
        lib: './src/lib.js',
        // chunk 名字为 index 入口文件为index.js文件
        index: ['babel-polyfill', './src/index/js']
    }
}
```

#### 函数类型入口

我们可以使用匿名函数来定义入口，只要吧匿名函数的返回值为上面介绍的形式即可。

```javascript
module.exports = {
    entry: () => './src/index.js'
}
```

```js
module.exports = {
    entry: () => ({
        // chunk 名字为 lib 入口文件为lib.js文件
        lib: './src/lib.js',
        // chunk 名字为 index 入口文件为index.js文件
        index: ['babel-polyfill', './src/index/js']
    })
}
```

使用函数可以添加代码逻辑来动态定义入口值，函数也支持异步地返回一个promise对象来进行异步操作

```js
module.export = {
    entry: () => new promise((resolve) => {
        setTimeout(() => {
            resolve('./src/index.js')
        }, 3000)
    })
}
```

#### 实例

##### 单页面应用

单页面应用一般情况下只定义单一入口即可：

```js
module.exports = {
    entry: './src/app.js'
}
```

无论是框架，模块，页面都由app.js单一入口引入，这样有个好处，只会产生一个js文件，依赖关系清晰。但这种方法也有弊端，所有模块打包到一起，在应用规模上升到一定程度时，会导致产生的资源体积过大，降低用户渲染页面的速度。

当一个bundle大小大于250kb时，webpack会发出警告。

如果工程的体积很大且只生成一个文件，一旦代码更新，哪怕只做出了一点点改动，用户都需要重新下载整个资源文件，这样对页面的性能

是不友好的。

未解决这个问题，可以采用提取vendor的方法。vendor字面量是供应商，在webpack中指一般工程所用的库、框架等第三方模块几种打包而产生的bundle。

```js
module.exports = {
    entry: {
        index: 'index.js',
        vendor: ['loadsh.js']
    },
    output: {
        filename: '[name].js'
    }
}
```

此时配置了一个名字为vendor的入口文件，内容为第三方依赖库，但没有vendor设置入口文件，所以webpack无法打包，所以此时可以使用CommonsCunkPlugin，但这个在webpack4之后被废弃了，之后使用optimization.splitChunks，将index.js和vendor中共有的第三方模块提取出来。这样app bundle中只包含业务代码，其依赖的第三方模块被抽取成一个新的bundle，从而达到提取vendor的目的。而vendor只包含第三个库，这个不会经常改动，可以有效利用客户端缓存，在后续用户请求页面时加快整体的渲染速度。

```js
// index.js
import addContent from './add-content.js'
import _ from 'loadsh'

document.write('My first Webpack app.<br />')

addContent()

const sourvfe = [1, 4, 5]
const target = _.concat(sourvfe, 15)
document.write(`sourvfs's length is ${target.length}`)
```

```js
// webpack.config.js
const path =  require('path');
const { OptimizationStages } = require('webpack');

module.exports = {
  context: path.join(__dirname, './src'),
  entry: './index.js',
  output: {
    filename: '[name].js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },
  mode: "development",
  devServer: {
    static: './dist'
  }
};
```

![1728114304968](image/1728114304968.png)

## 配置资源出口

### filename

filename控制输出资源的文件名，其值为字符串。filename不仅仅是bundle的名字，还可以是一个相对路径，即使路径不存在也没关系，webpack会在输出资源时创建该目录。

```js
module.exports = {
    ......
    output: {
        filename: 'bundle.js'
    },
}
```

```js
module.exports = {
    ......
    output: {
        filename: './js/bundle.js'
    },
}
```

filename也支持一种类似模版语言的形式动态地生成文件名。

```js
module.exports = {
    ......
    output: {
        filename: '[name].js'
    },
}
```

在生产输出资源时，webpack会将name换成chunk name。

其他的配置如下：

| 变量名称      | 功能描述                |
| ------------- | ----------------------- |
| [contenthash] | 当前chunk单一内容和hash |
| [chunkhash]   | 当前chunk内容的hash     |
| [id]          | 当前chunk的id           |
| [name]        | 当前chunk的name         |

变量的作用：

+ 当存在不同chunk时，会对不同的chunk进行区分。
+ 实现客户端缓存。表中的contenthash和chunkhash与chunk内容有关，在filename中使用他们有关内容后，那么chunk名字就与chunk内容有关了，当chunk内容改变时，资源文件名称就发生变化，从而在用户下一次请求资源文件时重新下载新的版本。chunkhash只有在自身chunk变化时才改变资源名称，因此在客户端资源缓存时，可以与name结合使用，如```'[name]@[chunk].js'```

### path

path指定输出位置，必须是绝对路径，通常是在dist目录下。

```js
module.exports = {
    ......
    output: {
        ......
        path: path.join(__dirname, 'dist')
    }
    ......
}
```

### publicPath

publicPath不同于path，从功能上来讲path用来指定资源的请求位置。页面中的资源分为两种，一种是由HTML页面直接请求的，比如通过script标签加载的js；另一种是由js或css来发起请求的间接资源，比如css请求某种图片或者字体，或者异步的js。publicPath的作用就是指定这部分间接资源的请求位置。

##### publicPath的几种情况

1. HTML相关

publicPath内容为相对路径，此时间接资源地址是相对于html位置。

```js
// 假如当前Html的位置为http://localhost: 8080/app/index.html
// 异步加载的js资源为 0.chunk.js
publicPath: '' // 请求地址为http://localhost: 8080/app/0.chunk.js
publicPath: './js' // 请求地址为http://localhost: 8080/app/js/0.chunk.js
publicPath: '../js/' // 请求地址为http://localhost: 8080/js/0.chunk.js
```

2. Host相关

如果publicPath内容为绝对路径，此时资源地址是相对于host

```js
// 假如当前Html的位置为http://example.com/app/index.html
// 异步加载的js资源为 0.chunk.js
publicPath: '/' // 请求地址为http:/example.com/0.chunk.js
publicPath: '/js/' // 请求地址为http://example.com/js/0.chunk.js
publicPath: '/dist/' // 请求地址为http://example.com/dist/0.chunk.js
```

3. CDN相关

当publicPath以协议头或相对协议的形式开始时，代表当前的路径是CDN相关。如：

```js
// 假如当前Html的位置为http://example.com/app/index.html
// 异步加载的js资源为 0.chunk.js
publicPath: 'http://cdn.com/' // 请求地址为http://cdn.com/0.chunk.js
publicPath: 'https://cdn.com/' // 请求地址为https//cdn.com/0.chunk.js
```



webpack-dev-server的配置中也有一个资源相关的配置--devServer.static，它的作用是用来指定webpack-dev-server的静态资源服务路径。

```js
module.exports = {
    entry: './index.js',
    output: {
        filename: 'bundle.js',
        path: path.join(__dirname, dist)
    },
    devServer: {
        static: '/assets/',
        port: 3000
    }
}
```

上面例子中启动webpack-dev-server后如果访问http://localhost:3000/dist/bundle.js会报错，因为webpack-dev-server指定的静态资源位置是assets，因此要去访问http://localhost:3000/assets/bundle.js。实际上为了避免开发环境和生产环境的不一致，webpack-dev-server应与path保持一致，static: '/dist/'

# 4. 预处理器

一个web工程通常包括HTML、css、js、模版、图片、字体等多种静态资源，这些资源之间会存在某种联系。对于webpack来说，这些资源都是一种模块，可以想加载一个js文件一样去加载他们，如在index.js中去加载style.css。在js中引入其他资源是很有意义的，如js中引入css，可以方便一个组件样式的管理。这样不必单独去维护js和css。

## loader

### loader是什么

loader是webpack的一个核心概念，它用于转换代码，本质上都是一个函数，可以理解为如下的形式```output = loader(input)```。input可能是代码源文件的字符串，也可能是loader函数转换后的结果。output则包括了转换后的代码、source-map、和AST对象。如果这是最后一个loader，结果将被送给webpack进行后续传力，否则会认为下一个loader向后。

例如，使用babel-loader将ES6转换成ES5，```ES5 = babel-loader(ES6)```。

loader可以是链式的，可以对一个资源设置多个loader，第一个loader的输入是源文件，剩下的loader都是上一个loader的结果，其形式如下，```output = loaderC(loaderB(loaderA(input)))```，就比如css的处理，```Style便签 = style-loader(css-loader(sass-loader(SCSS)))```。



==例如：==

```index.js
// index.js
import addContent from './add-content.js'
import _ from 'loadsh'

document.write('My first Webpack app.<br />')

addContent()

const sourvfe = [1, 4, 5]
const target = _.concat(sourvfe, 15)
document.write(`sourvfs's length is ${target.length}`)

import './style.css'
```

```css
body {
  text-align: center;
  padding: 100px;
  color: #fff;
  background-color: #09c;
}
```

此时没有任何loader，如果打包的话会报错。这是因为webpack无法处理css语法，因此排除了一个错误，并提示需要一个合适的loader来处理这种文件。

![1728132815468](image/1728132815468.png)

### loader引入

以css为例。

1. loader都是一些第三方npm模块，需要用npm下载。

```npm install css-loader -D```

2. 将loader引入工程，与loader相关的配置在module里，module.rules代表了模块的处理规则。

```js
module.exports = {
    ......
    module: {
    	rules: [{
      		test: /\.css$/,
          use: ['css-loader']
        }]
  	},
}
```

3. 只有css-loader并没有生效， 还需要style-loader来吧样式插入页面

```npm install style-loader -D```

```js
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }]
  },
```

### loader配置

module.rules代表了模块的处理规则。module·有很多配置项其中最重要的是test和use

+ test接收一个正则表达式，或者一个元素为正则表达式的数组，只有正则表达式匹配的模块才会使用这条规则。
+ use接收一个数组，数组包含该规则使用的loader。

### 链式loader

webpack在打包时会按照数组从后往前处理资源的，因此最先生效的要放在后边。

### loader option

loader作为预处理器通常会提供给开发者一些配置项，在引入loader的时候可以通过options传入

```js
module: {
    rules: [{
            test: /\.css$/,
      		use: ['style-loader', {
                loader: 'css-loader',
                option: {
                    // css-loader配置项
                }
            }]  
    }]
}
```

### exclude include

exclude与include用于排除或包含指定目录下的模块，**可接收正则表达式或者字符串（文件绝对路径）**

```js
rules: [{
    test: /\.css$/,
    use: ['style-loader', 'css-loader'],
    exclude: /node_modules/
}]
```

当exclude和include同时存在时，exclude的优先级更高

### resource和issuer

在webpack中，认为被加载模块是resource，而加载者是issuer。resource和issuer用来对被加载模块和加载模块增加限制。

```js
// index.js
import './style.css'
```

在上面例子中，index.js是issuer，style.css是resource

```js
rules: [{
    use: ['style-loader', 'css-loader'],
    resource: {
        test: /\.css$/,
        exclude: /node_modules/
    },
    issuer: {
        test: /\.js$/,
        exclude: /node_modules/
    }
}]
```

### enforce

 enforce用来指定 一个loader的种类，只接受pre或post两种字符串类型。

webpack的loader执行顺序有四种，pre、inline、post、normal，上述介绍的loader都是normal，而inline也被弃用，所有pre和post需要使用enforce来制定。

例如：

```js
rules: [{
    test: /\.js$/,
    enforce: 'pre'f,
    use: 'eslint-loader',
    
}]
```

 在上面例子中，添加了一个eslint-loader来对源码进行质量检查，其enforce值为pre，表示将在所有正常loader前执行，这样保证代码没有被其他的loader更改过。如果要在所有loader之后执行的话，需要指定为post

### babel-loader

babel-loader将ES6+转换成ES5.

在安装时推荐下面命令

```js
npm install babel-loader babel-core babel-preset-env -D
```

+ babel-loader是使babel和webpack协同工作的模块
+ @babel/core 是babel编译器的核心模块
+ @babel/preset-env 是babel推荐的预置器，可以根据用户设置的目标环境自动添加所需要的插件和补丁来编译ES6+代码

```js
{
      test: /\.js$/,
      exclude: '/node_modules/',
      use: {
        loader: 'babel-loader',
        options: {
          cacheDirectory: true, // 缓存机制，防止重复打包未改变的包
        }
      }
    }
```

### 自定义loader

在已有loader无法很好满足需求时，我们可以去修改或自定loader。

以实现一个js启用严格模式loader为例

1. 新建force-strict-loader项目，初始化npm，```npm init -y```，该目录下创建index.js，这个就是loader的主体

![1728198983581](image/1728198983581.png)

```js
// index.js
module.exports = function(content) {
  var useStrictPrefix = '\'use strict\';\n\n'
  return useStrictPrefix + content
}
```

2. 在项目中下载这个loader，```npm i ../../force-strict-loader -D```，并使用

```js]
const path =  require('path');
const { OptimizationStages } = require('webpack');

module.exports = {
  context: path.join(__dirname, './src'),
  entry: './index.js',
  output: {
    filename: '[name].js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }, {
      test: /\.js$/,
      exclude: '/node_modules/',
      use: {
        loader: 'babel-loader',
        options: {
          cacheDirectory: true,
        }
      }
    }, {
      test: /\.js$/,
      use: 'force-strict-loader'
    }]
  },
  mode: "development",
  devServer: {
    static: './dist'
  }
};
```

打包后main.js已加上use strict

![1728199171872](image/1728199171872.png)

3. 启用缓存，如果文件输入和依赖没有变化时，应该让loader直接使用缓存，而不是重复进行转换工作。启用缓存可以加快打包的速度，保证相同的输入产生相同的输出。在webpack中可以使用this.cacheable进行控制。

```js
module.exports = function(content) {
  if (this.cacheable) {
    this.cacheable()
  }
  var useStrictPrefix = '\'use strict\';\n\n'
  return useStrictPrefix + content
}
```

4. 获取options

loader的配置项都是通过use.options传入的，想要在自定义loader使用的话可以用```this.getOptions```方法获得

```js
// 自定义loader
module.exports = function(content) {
  if (this.cacheable) {
    this.cacheable()
  }
  var options = this.getOptions(options) || {}
  console.log('options', options)
  var useStrictPrefix = '\'use strict\';\n\n'
  return useStrictPrefix + content
}
```

```js
// webpack.config.js 中自定义包使用
{
    test: /\.js$/,
        use: [{
            loader: 'force-strict-loader',
            options: {
                sourceMap: true
            }
        }],
}
```

![1728202657784](image/1728202657784.png)

5. source-map功能实现

开启source-map可以使我们在浏览器的开发者工具中查看源码

# 5. 样式处理

## 分离样式文件

使用style-loader和css-loader会将css文件转换成style便签插入到页面中。但有个问题，css文件变成了标签，在生产环境下我们希望css以文件形式存在，因为这样有利于客户端进行缓存。为此，我们使用exttact-text-webpack-plugin来进行处理。

1. 下载exttact-text-webpack-plugin，```npm i mini-css-extract-plugin -D```

2. 配置webpack.config.jjs

```js
// webpack.config.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './src/index.js',
  mode: 'development',
  output: {
    filename: 'main.js',
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: [
        MiniCssExtractPlugin.loader,
        'css-loader'
      ]
    }]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'style.css'
    })
  ]
}
```

```js
// index.js
import './style.css'

document.write('hello webpack')
```

```css
// style.css
.container {
  border: 1px solid #000;
  color: blue;
  height: 400px;
  width: 200px;
}
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <script src="./main.js"></script>
  <div class="container"></div>
</body>
</html>
```

![1728219331540](image/1728219331540.png)

![1728219349833](image/1728219349833.png)

可以看到打包结果中存在style.css文件，并且样式在页面上生效了。

## 样式预处理

### sass与scss

sass是对css语法的增强，现在多用scss(对css3语法的增强)。使用的是sass-loader，但是能处理scss文件。

1. 安装依赖包，```npm install sass sass-loader -D```
2. 配置

```js
// html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./bundle.js"></script>
  <div class="container">
    <div class="box">
      class；box
    </div>
  </div>
  <style>
    .box {
      height: 200px;
      width: 60px;
      background-color: pink;
    }
  </style>
</body>
</html>
```

```js
// index.js
import './style.scss';
```

```scss
$font-color: blue;
.container {
  color: $font-color;
  .box {
    border: 1px solid #000;
  }
}
```

```js
// webpack-config.js
const path = require('path')

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist')
  },
  mode: 'development',
  module: {
    rules: [{
      test: /\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
      exclude: /node_modules/,
    }]
  }
}
```

![image-20241007085033604](image/image-20241007085033604.png)

可以看到对于页面中scss的样式已经生效，scss文件首先经sass-loader处理生成css，最终生成style插入到页面中。

开启source-map配置项可以查看源码

```js
// webpack.config.js
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./bundle.js"></script>
  <div class="container">
    <div class="box">
      class；box
    </div>
  </div>
  <style>
    .box {
      height: 200px;
      width: 60px;
      background-color: pink;
    }
  </style>
</body>
</html>
```

如下图所示，scss被编译如下形式

![image-20241007085639404](image/image-20241007085639404.png)

# 6. 代码分片

实现高性能应用的重要一点是尽可能让用户每次都只加载必要的资源，对于优先级级别不高的资源，则采用延迟加载等技术渐进式获取。这样可以保障首屏加载的速度。

代码分片就是这样一个可以提供应用性能的技术，我们通过代码分片，使用户不必一次性加载所有代码，而是按需加载。

## 通过入口划分代码

在web应用中通常会有一些不常变动的库或者工具，我们可以把他们放在一个单独的入口中，有该入口产生的资源不会经常更新，从而有利于客户端缓存，让用户不必在每次更新页面的时候重新加载。

```js
// index.js
console.log('1')
window.calculator.add(1, 8)
```

```js
// calculator.js
window.calcilator = { ...... }
```

```html
<script src='./dist/lib.js'></script>
<script src='./dist/app.js'></script>
```

```js
// webpack.config.js
entry: {
    app: './src/app.js',
    lib: ['lib-a', 'lib-b', 'lib-c']
}
```

==这种方式适用于将接口绑定在全局对象的库，因为业务代码中的模块无法直接使用库中的模块，二者属于不同的依赖数==

==缺点是手工的方式去配置和提取公共模块会变得非常复杂。==

## CommonsChunkPlugin

CommonsChunkPlugin是webpack4之前自带的用于提取公共模块的插件、

公共模块提取有以下好处：

+ 减少模块重复打包，提升开发效率
+ 减少整体资源体积
+ 合理分片后的代码有利于浏览器的缓存

如以下的例子：

```js
// foo.js
import react from 'react'

document.write(`foo.js react version is ${react.version}`)

// boo.js
import react from 'react'

document.write(`boo.js react version is ${react.version}`)

// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./boo.js"></script>
  <script src="./foo.js"></script>
</body>
</html>

//webpack.config.js
const path = require('path')

module.exports = {
  entry: {
    foo: './src/foo.js',
    boo: './src/boo.js'
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'dist')
  }
}
```

![1728306763487](image/1728306763487.png)

可以看到foo.js和boo.js的chunk都打包了react，都为1.5kb

我们此时引入CommonsChunkPlugin，webpack5已被移除，使用会提示报错，但打包后的会提取出一个公共模块，而foo.js和boo.js的体积都会变小。

```js
const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: {
    foo: './src/foo.js',
    boo: './src/boo.js'
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'dist')
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'commons',
      filename: 'commons.js'
    })
  ]
}
```

## optimization.SplitChunks

optimization.SplitChunks是webpack4实现的改进的代码分片，功能更加强大，而且简便易用

```js
// foo,js
import react from 'react'
import('./boo.js')

document.write(`foo.js react version is ${react.version}`)

// boo.js
import react from 'react'

document.write(`boo.js react version is ${react.version}`)

// webpack.config.js
module.exports = {
  entry: './src/foo.js',
  output: {
    filename: 'foo.js',
  },
  mode: 'development',
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  }
}
```

![1728310921288](image/1728310921288.png)

可以看到打包结果有三个包一个main.js是入口文件的打包结果，src_boo_js.js是异步加载的结果,vendors-node_modules_react_index_js.js是模块提取的结果。

**optimization.SplitChunks指定chunks为all表示SplitChunks将对所有的chunk生效。**

### SplitChunks默认配置

==SplitChunks代码分片的条件有以下几条，当满足默认条件时才会提取==

+ 提取后的chunk可被共享或其来自node_modules目录。
+ 提取后的javascript chunk要大于20KB css chunk要大于50KB。这是因为如果提取后的资源体积太小，那么优化效果也会打折扣。
+ 在按需加载过程中，并行请求的资源最大值小于等于30。按需加载指的是，通过动态插入script脚本方式加载脚本，一般来说不希望同时加载过多的资源，因为每一个请求都要带来建立和释放的成本，因此提取规则只在并行请求不多的时候生效。
+ 在首次加载时，并行请求的资源数量最大值小于等于30。原因和上条类型，在首页加载时我们有性能的需求，因此我们可以将其设置更低。

比如上个例子，在从foo.js和boo.js提取react前，系统会对上述条件一一验证，只有满足了所有条件react才会被提取出来。

+ react属于node_modules目录下的模块
+ react的体积大于20KB
+ 按需加载数量为1，为src_boo_js.js
+ 首次加载数量为2，vendors-node_modules_react_index_js.js和main.js。vendors-node_modules_react_index_js.js不算按需加载的数量，因为他是添加在HTML的script标签里的，在页面初始化的时候就进行加载。

### 默认的异步提取

不设置chunks: all的话默认针对异步资源。

### 配置

SplitChunks的默认配置

```js
splitChunks: {
    chunks: 'async',
    minsize: 20000,
    minRemainingSize: 0,
    minChunks: 1,
    maxAsyncRequests: 30,
    maxInitialRequest: 30,
    enforceSizeThreshold: 50000,
    cacheGroups: {
        vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
        },
        default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
        }
    }
}
```

(1) 匹配模式

通过chunks我们可以配置SplitChunks的工作模式。它有三个值，分别是async（默认）、initial和all。async即只提取异步chunks，initial只对入口文件生效，all则同时开启两种模式。

(2) 匹配条件

minSize、minChunks、maxAsyncRequests、maxInitialRequests都属于匹配条件。

(3) cacheGroups

可以理解成分离chunks时的规则。默认情况下有两种规则-vendors和default。vendors是用于提取所有node_modules中符合条件的模块，default则作用于被多次引用的模块。我们可以对这些规则进行增加和修改，若果想要禁止某种规则，也可以将其设置为false。当一个模块同时符合多个cacheGroups时，则根据其中的priority配置来确定其优先级。

## 异步加载

==什么是按需加载==：当模块数量过多、资源体积过大时，可以延迟加载一些暂时用不到的模块。这样可以使用户在页面初次渲染的时候下载尽可能小的模块，等到恰当时机再去触发加载后续的模块。

### import

import函数是webpack中的异步资源加载方式之一。其与ES6的import语法不同，通过import函数加载的模块及其依赖会被异步地加载，并返回一个Promise对象。

```js
// foo.js
import('./bar.js').then(({ add } => {
    console.log(add(1, 2))
}))

// boo.js
export function add(a , g) {
    return a + b
}
```

此时还需要修改webpack配置

```js
module.exports = {
    entry: './src/index.js',
    output: {
        publicPath: '/dist/',
        filename: '[name].js'
    },
    mode: 'development',
    devServer: {
        static: '/dist/',
        port: 3000
    }
}
```

这里我们配置了publicPath，因为这种间接资源(通过首屏js再进一步加载的js)的位置是通过publicPath来指定。上面的import函数加载的bar.js变成了间接资源，所以需要配置publicPath

实例如下

```js'
// foo.js
import('./boo.js').then(({ add }) => {
  console.log(add(1, 2))
})

document.write('foo.js')

// boo.js
export function add(a, b) {
  return a + b
}

// webpack.config.js
module.exports = {
  entry: './src/foo.js',
  output: {
    filename: '[name].js',
    publicPath: '',
  },
  mode: 'development',
}

// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./main.js"></script>
</body>
</html>
```

![1728484822955](image/1728484822955.png)

可以看到打包结果有两个一个main.js是入口文件的打包结果，一个是src_boo_js.js的打包结果，是异步资源boo.js的打包结果，其中main.js是html通过script标签加载的，而异步加载的资源在打包时需要通过publicPath指定位置，由于index.html和打包结果在一个文件夹下，所以```publicPath: ''```。而我们查看浏览器的网络请求发现请求了src__boo_js.js

![1728485080605](image/1728485080605.png)

![1728485126264](image/1728485126264.png)

可以看到这是由main.js也就是foo.js产生的请求。这产生的原理是，通过JavaScript在页面的head标签里 插入一个script标签，请求./src_boo_js.js，原本的HTML页面中并没有该标签，是动态生成的。

import异步加载不必出现在代码的顶层作用域，在任何位置都可以。同时这种异步加载方式可以赋予应用很强的动态特性，他经常被用在用户切到某些特定路由时去渲染相应组件，这样分离之后首屏加载的资源就会小很多。

### 异步chunk的配置

现在生成了异步资源，为了增强可读性，我们还可以通过一些webpack的配置来为其添加有意义的名字。

```js
// foo.js
import(/* webpackChunkName: "bar" */ './bar.js').then(({ add }) => {
    console.log(add(1, 2));
})

// webpack.config.js
module.export = {
    ......
    output: {
      publicPath: '/dist/',
      filename: '[name].js',
      chunkFilename: '[name].js',
    },
    ......
}
```

output.chunkFilename用来指定异步资源生成的chunk的名字。在foo.js中我们可以通过特有的注释/* webpackChunkName: "bar" */来让webpack获取到异步chunk的名字。

# 7.  生产环境配置

到了生产环境中，资源打包将遇到很多新的问题，在生产环境中需要关注的是如何让用户更快地加载资源，涉及如何压缩资源。如何添加环境变量优化打包。如何最大限度地利用缓存。

## 环境配置的封装

==如何让Webpack按照不同的环境采用不同的配置，有如下两种方式==

1. 使用相同的配置文件。

令webpack不管在什么环境下打包都是用webpack.config.js，只是在构建开始前将当前所属环境作为一个变量传进去，然后在webpack.config.js中通过各种判断条件来决定具体使用哪个配置。

```js
// package.json
{
    ......
    "scripts": {
        "dev": "set ENV=development && webpack serve",
        "build": "set ENV=production && webpack"
    }
}

// webpack.config.js
const ENV = process.env.ENV;
const isPriod = ENV === 'production';

module.exports = {
    output: {
        filename: isPriod ? '[name]@[chunkhash].js' : 'bundle.js',
    },
    mode: ENV,
}
```

在上面例子中通过npm脚本命令传入一个ENV环境变量，然后让webpack.config.js根据它的值来确定具体采用什么配置。

2. 为不同环境创建各自的配置文件。比如，单独创建一个生产环境webpack.production.config.js，开发环境webpack.development.config.js。然后在通过--config指定打包时候使用的配置文件

```js
// package.json
{
    ......
    "scripts": {
        "dev": "Webpack serve --config=webpack.development.config.js",
         "build": "webpack ==config=webpack.production.config.js"
    },
    ......
}
```

## mode

设置mode配置项值为production，即可将webpack的打包模式切换为生产环境，从而webpack自动添加许多适用于生产环境的配置项。

## 环境变量

项目中我们可能会为生产环境和本地环境添加不同的环境变量，在webpack中我们可以通过webpack自带的DefinePlugin插件来进行设置。

```js
// index.js
document.write('ENV is ', ENV, '<br>');
document.write('IS_PRODUCTION is ', IS_PRODUCTION, '<br>');
document.write('ENV_ID is ', ENV_ID, '<br>');
document.write('CONSTANTS ', CONSTANTS, '<br>');

// webpack.config.js
const webpack = require("webpack");

const ENV = process.env.ENV;
const isPriod = ENV === 'production';

module.exports = {
  entry: './src/index.js',
  output: {
    filename: '[name].js',
  },
  plugins: [
    new webpack.DefinePlugin({
      ENV: JSON.stringify(ENV),
      IS_PRODUCTION: isPriod,
      ENV_ID: 130912098,
      CONSTANTS: JSON.stringify({
        TYPES: ['index'],
      }) 
    })
  ]
}

// package.json
{
  "name": "env_variable",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "set ENV=production && webpack",
    "dev": "set ENV=development && webpack"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "webpack": "^5.95.0",
    "webpack-cli": "^5.1.4"
  }
}


// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script src="./main.js"></script>
</body>
</html>
```

我们在终端输入命令npm run build，可以看到如下效果，在index.js中成功获取到了环境变量并输出。

![image-20241010112648364](image/image-20241010112648364.png)

DefinePlugin在使用的时候需要在字符串类型的值外边加上JSON.stringify，这是因为DefinePlugin在替换环境变量时是直接替换的，如果不用JSON.stringify的话，他会将变量直接替换成变量名字，也就是说上面例子的话，ENV：ENV的话，最终环境变量ENV的值就是ENV。

==process.env.NODE_ENV:==

许多框架和库都采用process.env.NODE_ENV作为一个区别开发环境和生产环境的变量。process.env是Node.js用于存储当前进程环境变量的对象，NODE_ENV让开发者指定当前运行时环境，当值为production时代表当前环境是生产环境。库和框架在打包的时候发现当前环境为生产环境后就可以去掉一些开发环境代码，如警告信息和日志等。这有助于提升代码运行速度和减小体积资源。

**如果启用了mode: production，则webpack已经设置好了process.env.NODE_ENV，不需要再人为添加了。**

## source-map

source-map指的是将编译、打包、压缩后的代码映射回源代码的过程。

### 原理

Webpack对于工程源代码的每一步处理都有可能改变代码的结构、位置甚至是文件内容，因此每一步都需要生成一个source-map。若启用了devtool配置项，source-map就会跟随源代码一起被传递，最终生成map文件，默认是打包后加上.map。在生成映射文件同时，bundle.js文件中会追加上一句注释来表示map文件位置。不打开开发者工具，映射文件不会加载

```js
// bundle.js
(function() {
    // bundle.js
})();
// # sourceMappingURL=bundle.js.map
```

## souce-map配置

javascript的source-map的开启只需要在webpack.config.js里添加devtool值为source-map即可

对于css、scss、less等需要配置额外的source-map配置项。

## 资源压缩

在将资源发布到 线上环境前通常会进行资源压缩，移除代码中多余的空格、换行及执行不到的代码，缩短变量名，在执行结果不变的前提下将代码替换成更短的形式。

### 压缩Javascript

使用config.optimization.minimize配置，同时可以使用terser-webpack-plugin插件自定义配置。mode为production的话则不需要人为设置开启。

```js
module.exports = {
    ......
    optimizition: {
        minimize: true,
    }
}
```

```js
const TerserPlugin = require('terser-webpack-plugin')
module.exports = {
    ......
    optimization: {
        minimizer: [
            new TerserPlugin({
                test: /\.js(\?.*)?$/i,
                exclude: /\/excludes/,
            })
        ]
    }
}
```

### css压缩

使用css-minimizer-webpack-plugin插件进行压缩。

```js
npm install css-minimizer-webpack-plugin --save-dev
```

```js
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
 
module.exports = {
  // ...
  optimization: {
    minimizer: [
      // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`)
      // webpack 5 使用 ... 语法来扩展现有的压缩器 (例如 `terser-webpack-plugin`)
      `...`,
      new CssMinimizerPlugin(),
    ],
  },
  // ...
};
```

## 缓存

**缓存是指重复利用浏览器已获取过的资源。合理地使用缓存是提升客户端性能的一个关键因素。具体的缓存策略是由服务器来决定的，浏览器会在资源过期前一直使用本地缓存进行响应。**

**假如有个Bug，修改后上线想使所有人更新资源，而不是用缓存，那么就要做到资源url的更新，强迫客户端去下载新的资源。**

方法是使用chunkhash命名资源，代码变化后hashchunk也会变化。

```js
module.exports = {
    entry: './src/idnex.js',
    output: {
        filename: '[name]@[chunkhash].js',
    },
    mode: 'development',
}
```

但资源名称修改后html中引用路径就发生了改变，我们手动去维护是个很麻烦的事。因此我们可以使用html-webpack-plugin去输出动态的html

### 输出动态html

```js
npm i html-webpack-plugin -D
```

```js
// app.js
document.write('app.js', '<br>');

// webpack.config.js
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: './src/app.js',
  output: {
    filename: '[name]@[chunkhash].js',
    path: path.join(__dirname, 'dist'),
    publicPath: '',
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'my-app', // html标题
      template: './dist/index.html', // 模版位置
      inject: 'body', // 脚本注入位置 true | 'body' | 'head' | false
      minify: { // 对html文件进行压缩
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
  ],
}

// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

![image-20241011091644800](image/image-20241011091644800.png)

可以看到html-webpack-config帮我们自动往html中插入了script脚本。假如没有设置template的话，webpack就会自己生成一个html，但如果指定了模版的话，我们可以添加更多个性化的内容。

当我们改变app.js内容，发现打包结果的名称也发生了改变。

```app.js
document.write('app.js-1', '<br>');
```

![image-20241011092017591](image/image-20241011092017591.png)

### chunk id的稳定

我们使用optimization.splitChunks进行代码分块，将符合条件的依赖单独生成一个资源包，在依赖版本不变的情况下希望这个资源包的名字并不改变，这样客户端就可以使用本地缓存来读取这个依赖，只更新那些改变的资源。

```js
// app.js
import React from 'react';

document.write('React', React.version);

// webpack.config.js
module.exports = {
  entry: {
    app: './src/app.js',
  },
  output: {
    filename: '[name]@[chunkhash].js',
  },
  mode: 'development',
  optimization: {
    splitChunks: {
      chunks: 'all',
    }
  }
}
```



![image-20241011101142507](image/image-20241011101142507.png)

我们修改app.js，再进行打包，会发现这一资源名称不变，符合我们的预期。

```js
// app.js
import React from 'react';

import './foo.js';

document.write('React', React.version);
```

![image-20241011101608869](image/image-20241011101608869.png)

## bundle体积监控和分析

### webpack-bundle-analyzer

webpack-bundle-analyzer会帮我们分析bundle的组成，其会生成一张bundle模块组成结构图，展示摸个模块所占体积。

使用如下：

```js
npm i webpack-bundle-analyzer -D
```

使用的话在webpack.config.js中配置即可

```js
// webpack.config.js
const { plugins } = require('../dynamic_html/webpack.config');

const Analyzer = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  entry: {
    app: './src/app.js',
  },
  output: {
    filename: '[name]@[chunkhash].js',
  },
  mode: 'development',
  optimization: {
    splitChunks: {
      chunks: 'all',
    }
  },
  plugins: [
    new Analyzer(),
  ]
}
```

![image-20241011103000630](image/image-20241011103000630.png)

![image-20241011103027234](image/image-20241011103027234.png)

![image-20241011103101682](image/image-20241011103101682.png)

### Import Cost

这个是vscode的插件，能帮我们对引入模块的大小进行实时监控。

![image-20241011103519490](image/image-20241011103519490.png)

# 8. 打包优化

提升性能无非两种方式：

1. 提升资源，使用更多的CPU和内存，用更多的计算能力来缩短任务执行的时间。
2. 缩小范围，去掉冗余的流程，不做重复的工作等等。

## 多线程打包优化打包速度

### 问题产生原因 && loader工作流程

**webpack打包过程中有一个非常耗时的工作，那就是loader对各种资源进行转译处理**。最常见的loader有babel-laoder转译ES6+语法和ts-loader转换typescript。

==代码转译的工作流程：==

+ 1. 从配置获取入口文件
+ 2. 匹配loader规则，对入口模块进行转译。
+ 3. 对转译后的模块进行依赖查找（如a.js中加载了b.js和c.js）
+ 4. 对找到的依赖重复2、3直到没有新的依赖模块

webpack是单线程的，假如一个模块依赖多个模块，webpack要依次的进行转译。而解决这个问题，可以使用多线程打包，多个线程并行的进行代码的转译。

### webpack5 多线程打包

webpack5默认启用了一种名为smart的多线程系统，他会根据系统的CPU核心数量自动调整线程数。

可以在package.json中配置webpack选项来设置打包的显示。

```js
// package.json
"script": {
    "build": "webpack --progress --color" // --progress显示编译进度的条状输出 --color 输出结果带彩色 耗时较长的步骤用红色显示
}
```

### HappyPack

HappyPack是一个使用多线程打包的插件。在实际使用时，需要用HappyPack提供的loader来替换原有的loader，并将原有的loader通过HappyPack传进去。

```js
// package.json
{
  "name": "happy_pack",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "webpack"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "happypack": "^5.0.1",
    "html-webpack-plugin": "^5.6.0",
    "webpack": "^5.95.0",
    "webpack-cli": "^5.1.4",
    "babel-loader": "^8.2.5"
  },
  "dependencies": {
    "@babel/core": "^7.25.8",
    "@babel/preset-env": "^7.25.8"
  }
}

// app.js
const obj = {
  car: 'xiaomi',
  animal: 'elephant',
};

const { car } = obj;
document.write(car);

// webpack.config.js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HappyPack = require('happypack')

module.exports = {
  entry: './src/app.js',
  output: {
    filename: '[name]@[chunkhash].js',
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'happypack/loader',
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dist/index.html'
    }),
    new HappyPack({
      loaders: [
        {
          loader: 'babel-loader',
        }
      ]
    })
  ]
}
```

![image-20241012185519730](image/image-20241012185519730.png)

在单个loader的打包中，我们使用happypack的loader替换原有的loader。

而在使用happypack优化多个loader时，需要为每一个loader配置一个id，因为happypack无法知道loader与插件如何一一对应。例子如下：

```js
// webpack.config.js

const HappyPack = require('happypack')
module.export = {
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'happypack/loader?id=js'
            },
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'happypack/loader?id=ts'
            }
        ]
    },
    plugins: [
        new HappyPack({
            id: 'js',
            loaders: [{
                loader: 'babel-loader',
                options: {}
            }]
        })
        new HappyPack({
        	id: 'ts',
        	loaders: [{
        		loader: 'ts-loader',
        		options: {}. // ts options
        	}]
        })
    ]
}
```

优化 多个loader就要使用多个loader，意味着插入多个HappyPack插件，每个插件加上id标识。

## 缩小打包作用域

### exclude和include

### noParse

noParse配置是使webpack完全不解析匹配文件，不应用任何loader规则。

```js

module.export = {
    ......
    module: {
        noParse: /add-content.js/, // webpack不解析add-content.js文件
    }
}
```

noParse也可以支持路径匹配

```js
noParse: function(fullPath) {
    // fullPath是绝对路径 /User/me/app/webpack-no-parse/lib/loadsh.js
    return /lib/.test(fullPath) // 配置不解析lib文件夹下文件
}
```

### IgnorePlugin

IgnorePlugin使某些文件不进行打包，即使引用了这些文件，例如有个库Moment.js，这个库专门用于处理日期时间，他的内部有许多本地化相关的语言包，占很大提交，我们用不到的话可以使用IgnorePlugin处理，这些文件最后不打包。

```js
plugins: [
    new IgnorePlugin({
        resourceRegExp: /^\.\/locale$/, // 匹配资源文件
        contextRegExp: /moments$/, // 匹配检索目录
    })
]
```

### exclude、include & noParse & IgnorePlugin区别

exclude include是用来确定loader的作用范围 noParse指定不去解析的内容，但仍会打包，而IgnorePlugin是完全排除一些模块，这些模块即便引用了也不会打包。

### 缓存

使用缓存可以减少webpack重复打包工作，提升打包效率。我们可以令webpack将已经预编译的文件内容保存到一个特定目录中。当下一次执行打包指令时，可以去查看源文件是否发生改动，没有改动就直接使用缓存即可，中间的各种预编译过程可以直接跳过。

webpack5中可以通过cache配置项来开启。默认情况下它会在开发模式中开启，生产模式下禁用。

缓存有两种类型，一种是基于内存的缓存，一种是文件的缓存。文件缓存需要强制开启，同内存缓存相比文件缓存时间更长。

两种缓存方式如下：

```
// 基于内存的缓存
module.exports = {
	cache： true,
}

// 基于文件的缓存
module.exports = {
	cache: {
		type: 'filestystem'
	}
}
```

#### 文件缓存的弊端

文件缓存可能带来一定的风险。例如我们采用文件缓存，已经进行过一次打包，那么此时源代码内容已被缓存，如果此时我们升级了一个插件，并重新进行打包，但此时源代码内容没变，缓存检查过后发现没有改动，会直接采用缓存，进而可能导致引发问题。类似情况有

+ 更改webpack配置
+ 通过命令行传入不同构建参数
+ loader、plugin或者第三方包更新
+ Node.js、npm或yarn更新

内存缓存的存在时间很短，其只在开发模式下启用，可以在一定程度下避免这种情况的出现。

解决方法是配置cache.version，如果有了更新可以手动更改cache.version来让缓存过期。

```js
// webpack.config.js
module.exports = {
    ......
    cache: {
        type: 'filestystem',
        version: '1.1.1'
    }
}
```

### 去除死代码

ES6 Module依赖关系的构建是代码编译时，而非代码运行时。基于这项特性webpack提供了去除死代码的能力，他可以在打包过程中帮助我们检测工程中是否有没有被引用过的模块。webpack会对这部分代码进行标记，并在资源压缩时最终将他们从最终的bundle中去除。

```js
// index.js
import { foo } from './util'
foo()

// util.js
export function foo() {
    console.log('foo')
}

export function bar() { // 没有被任何其他模块引用，属于死代码
    console.log('bar')
}
```

webpack打包时会在bar()处添加一个标记，在开发模式下它仍然存在，只是在生产环境的压缩那一步会被移除掉。

==使用webpack进行依赖关系构建==

如果我们使用了babel-loader，那么一定要通过配置来禁用它的模块依赖解析，因为如果由babel-loader来做依赖解析，webpack接收到的都是转化过的CommonJs形式的模块，无法对死代码进行去除。禁用babel-loader模块依赖解析的配置示例如下：

```js
module.exports = {
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            use: [{
                loader: 'babel-loader',
                options: {
                    presets: [
                        [@babel/preset-env, { modules:  false }]
                    ]
                }
            }]
        }]
    }
}
```

webpack提供的去除死代码功能只是将死代码标记，真正去除死代码时通过压缩文件进行，可以使用terser-webpack-plugin，而在webpack5中只需要将mode设置为production即可。

# 9. 开发环境调优

## webpack开发效率插件

### webpack-dashboard

webpack-dashboard会帮助我们在控制台输出有用的打包信息。webpack-dashboard还另外需要配置启动命令，将原有的启动命令作为参数传给他。

```js
// webpack.config.js
const path =  require('path');
const DashBoardPlugin = require('webpack-dashboard/plugin')

module.exports = {
  context: path.join(__dirname, './src'),
  entry: './index.js',
  output: {
    filename: '[name].js',
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }, {
      test: /\.js$/,
      exclude: '/node_modules/',
      use: {
        loader: 'babel-loader',
        options: {
          cacheDirectory: true,
        }
      }
    }, {
      test: /\.js$/,
      use: [{
        loader: 'force-strict-loader',
        options: {
          sourceMap: true
        }
      }],
    }]
  },
  plugins: [
    new DashBoardPlugin()
  ],
  mode: "development",
};

// package.json
"build": "webpack-dashboard -- webpack",
```

![1728811238267](image/1728811238267.png)

### webpack-merge

用于管理公共webpack配置。对于需要配置多个打包环境的项目来说，webpack-merge是一个非常实用的工具，假如我们的项目对应有3种不同的配置，分别对应本地环境。测试环境、生成环境。每一种环境都是不同的，但也有一些公共部分，那么我们将这个公共部分提取出来。

我们创建一个webpack.common.js来存放这些配置；

``` js
// webpack.common.js
module.exports = {
    entry: 'app.js',
    output: {
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.(png|jpg|gif)$/,
                use: 'file-loader'
            },
            {
                test: /.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            }
        ]
    }
}
```

每种环境都有一个配置文件，生成环境的配置文件为webpack.priod.js，我们可以引入公共配置

```js
// webpack.priod.js
const commonfig = require('./weboack.common.js')
module.exports = Object.assign(commonfig, {
    mode: 'production'
})
```

如果此时生产环境我们想更改css增加一个样式单独打包功能，那么需要修改webpack.priod.js。然而通过require引入公共样式的方法，我们没法找到css的规则，只能整个替代module。

```js
// webpack.priod.js
const commonConfig = require('./webpacl.common.js')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = Object.assign(commonConfig, {
    mode: 'development',
    module: {
        rules: [{
            test: /\.(png|jpg|gif)$/,
            use: 'file-loader'
        },
        {
			test: /\.css$/,
            use: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: 'css-loader'
            })
        }]
    }
})
```

webpack-merge可以很好解决这个问题

webpack-merge使用方法，webpack使用start方法合并配置文件

```
npm i webpack-merge -D

const merge = require('webpack-merge')
const commonConfig = require('./webpacl.common.js')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = merge.smart(commonConfig, {
	mode: 'production',
	module: {
		rules: [
			{
				test: /\.css$/.
				use: ExtractTextPlugin.extract({
					fallback: 'style-loader',
					use: 'css-loader'
				})
			}
		]
	}
})
```

webpack-merge在合并module.rules的过程中会以test属性作为标识符，当发现有相同项出现时，会以后面的规则覆盖前面的规则，这样我们不需再添加荣誉代码了。

### 其他有用工具

==speed-measure-webpack-plugin==

speed-measure-webpack-plugin（简称SMP）可以分析webpack整个打包过程中在各个loader和plugin上耗费的时间，帮助我们找出构建过程中的性能瓶颈。

==size-plugin==

size-plugin可以帮助我们监控资源体积的变化，尽早地发现问题。

## 模块热替换

+ 早起的代码调试方式是改代码-刷新网页查看结果-再改代码
+ 后来一些web开发框架和工具提供了一种更便捷的方式，只要监测到代码更懂就会自动重新构建，然后触发网页刷新。这种一般被称为live reload
+ webpack在live reload基础上更进一步，让代码在网页不刷新的前提下得到最新的改动，甚至可以让我们再不需要重新发起请求就能看到更新后的效果。这就是模块热替换(Hot Module Replacement, HMR)

### 开启HMR

HMR是需要手动开启的，并且有一些必要条件。

1. 首先我们要确保项目基于webpack-dev-server或者基于webpack-dev-middle进行开发，webpack本身命令行并不支持HMR

配置webpack-dev-server

```
npm i webpack webpack-cli webpack-dev-server -D
npm i html-webpack-plugin -D
```

```js
// package.json
{
  "name": "hot_module_reload",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "webpack",
    "dev": "webpack serve"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "html-webpack-plugin": "^5.6.2",
    "webpack": "^5.95.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^5.1.0"
  }
}

// app.js
console.log('hello HMR')

// webpack.config.js
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'development',
  entry: './src/app.js',
  output: {
    filename: '[name].js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dist/index.html',
      inject: 'body',
    })
  ],
  devServer: {
    static: '/dist',
   	port: 9000, // 端口号
    open: true, // 自动打开浏览器
  },
}

// index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script>
    document.write('index.html', '<br>')
  </script>
</body>
</html>
```

2. 配置启用HMR

```js
// webpack.config.js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  entry: './src/app.js',
  output: {
    filename: '[name].js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dist/index.html',
      inject: 'body',
    }),
    new webpack.HotModuleReplacementPlugin(),
  ],
  devServer: {
    static: '/dist',
    hot: true, // 启用HMR
    port: 9000, // 端口号
    open: true, // 自动打开浏览器
  },
}
```

上面配置的结果会为每个模块绑定一个module.hot对象，这个对象包括HMR的API。借助这个API我们可以实现对特定模块开启或关闭HMR，也可以添加热替换之外的逻辑。调用HMR API有两种方式，一种是手动添加这部分代码，一种是借助一些现成的工具，比如```react-hot-loader、vue-loader```等。

如果应用简单，我们可以直接手动添加代码来开启HMR，比如下面例子；

```js
// app.js
import * as util from './util'
const { add } = util

console.log(add(1, 5))
console.log('hello HMR')

if (module.hot) {
  module.hot.accept()
}
```

**app.js是应用的入口，把调用HMR API的代码放在该入口中，这样HMR对于app.js和其他依赖的所有模块都生效。当发现有模块内容发生变动时，HMR会使应用在当前浏览器环境下重新执行一遍index.js的内容。但是页面本身不会刷新。**

HMR在触发过程中可能会出现预想不到的问题，导致模块更新后应用的表现和正常加载的表现不一样，webpack社区中有许多工具提供了类似的解决方案，比如react组件的热更新由react-hot-loader来处理。

### HMR原理

在开启HMR的状态下进行开发，会发现资源的体积会比原来大会多，这是因为webpack为了实现HMR注入了很多的代码。

在本地开发环境下，浏览器是客户端，webpack-dev-server（WDS）是服务端。**HMR的核心是客户端从服务端拉取更新后的资源（HMR拉取的不是整个资源文件，而是chunk diff，即chunk需要更新的部分）**。

1. 首先是确定浏览器怎么知道代码有了更新，什么时候去拉这块更新的资源。这就需要WDS对本地源文件进行监听。实际上WDS与浏览器之间维护了一个websocket，当本地资源发生变化时，WDS会向浏览器推送更新事件，并带上这次构建的hash，让客户端与上一次资源进行对比。通过对比hash可以防止冗余更新的出现。因为很多时候源文件的更改并不一定代表构建结果的更改（如添加了一个文件末尾空行）。

启动webpack-dev-server后，打开浏览器有websocket连接

![image-20241021160235292](image/image-20241021160235292.png)

当修改app.js后会发现发送了消息，hash值发生了变化

![image-20241021160414449](image/image-20241021160414449.png)

websocket并不是只有开启HMR后才有的，live reload其实也是依赖这个页面实现。

2. 知道了拉取更新资源的时机后，下一步就要知道去拉取什么。这部分信息没有包含在刚刚的websocket中，而是由客户端向WDS发送一个请求来获取更改文件的列表，即哪些模块发生了改动，这个请求的名字为[hash].hot-update.json

下图中请求了一个json文件，结果告诉main这个chunk发生了变动。

![image-20241021161144850](image/image-20241021161144850.png)

![image-20241021161150408](image/image-20241021161150408.png)

然后客户端继续向WDS请求，获取该chunk的增量更新。

![image-20241021161510017](image/image-20241021161510017.png)

3. 客户端在获取到了这些chunk的更新后怎么处理，就用到了其提供的相关api了（如前面提到的module.hot.accept），这些api供开发者针对自己场景进行处理，像react-hot-loader和vue-loader也是借助这些api来实现的HMR。

### HMR API示例

一个实际使用HMR API的例子。

```js
// index.js
import { logToScreen } from './util.js'
let count = 0
console.log('setInterval starts')
setInterval(() => {
    counter += 1
    logToScreen(counter)
}, 1000)

// util.js
export function logToScreen(content) {
    document.body.innerHTML = `content: ${content}`
}
```

这个例子的实现是在屏幕上输出一个整数并且每秒加1.如果我们对它添加HMR，最简单的方式如下所示。

```js
if (module.hot) {
    module.hot.accept()
}
```

上述代码让index.js及其依赖只有发生变化就在当前环境下全部重新执行一遍，那么它就会带来一个问题：在当前的运行时已经有了一个setInterval，每次HMR过后又会添加新的setInterval。最终导致页面上有多个数字。

为了避免这个问题，可以让HMR对index.js不生效。也就是说，当index,js发生改变时，直接让整个页面刷新，以防逻辑出现问题。但其他模块仍然可以让HMR继续生效。代码修改如下：

```vue
if (module.hot) {
	module.hot.decline()
	module.hot.accept(['.util.js'])
}
```

```module.hot.decline```将当前index.js的HMR关掉，当index.js自身发生变化时禁止使用HMR进行更新，只能刷新整个页面。而```module.hot.accept(['./utils.js'])```允许util.js使用HMR更新。

# 10. webpack打包机制

在执行打包命令后，项目中的源代码得到了处理，其中可能有一些语法转译，配置好的插件会协同工作，最后生成一系列静态资源并放置到一个目录下。从宏观来看，webpack就像个函数，输入一个个有依赖关系的模块，最终输出静态资源。

```assets=webpack(modules)```

![image-20241024202119223](image/image-20241024202119223.png)

左右两边展示了不同的构建模式，分别是build模式和warch模式。构建的步骤分别为加载缓存、打包、输出资源、展示结果、保存缓存，最后退出进程。build模式和watch模式的区别仅在于，watch模式会在文件系统中为源文件添加上watcher，当监听到文件改动时，Webpack会重新加载缓存、打包资源并执行后续的而过程。

## 准备工作

在开始工作之前，webpack会进行一次配置项的检查。我们也可以单独运行webpack configtest命令来进行该检查。配置项可以通过命令行获取，也可以通过配置文件获取。当命令行和配置文件有相同的配置项时，命令行中的优先级级别更高。

默认的配置文件名是webpack.config.js，如果需要更改为其他的文件名，要将其路径通过参数传给webpack，如：

```js
webpack --config webpack-development.config.js
```

webpack对配置项是有白名单的，也就是所有传进去的配置都必须是有效的，当发现配置项中有无效字符段时，webpack会终止打包并给出错误提示。

我们可以使用webpack-cli进行项目的初始化，它会询问将会使用的各种特性，这帮助我们可以不从零开始配置。初始化命令为

```
npx webpack-cli init
```

![1730028449374](image/1730028449374.png)

## 缓存加载

在验证了配置文件的正确后，webpack还有一个重要工作，就是加载缓存。在webpack5中，缓存分为两种，一种是内存中，一种是文件系统中。build构建模式下只能使用文件系统缓存，因此在每次构建完成之后，webpack使用的内存就会被释放掉，而文件系统可以一直存在。而使用文件系统的好处就是，即使重新打开一个命令行重新编译，webpack也能找到之前的缓存，从而加快构建速度。

加载缓存中，验证缓存是否有效是个特别重要的一步。对于内存缓存属于webpack内部管理，我们无法过多介入，对于文件缓存系统，我们则要面对验证缓存问题。

webpack管理缓存的方法有：

+ 打包依赖
+ 缓存名称
+ 缓存版本

### 打包依赖

webpack5中有一个配置项```cache.buildDependencies```配置项，它可以为缓存添加上额外的文件或目录依赖。当监测到```cache.buildDependencies```中文件或目录发生变化时，原有的缓存就会失效。

传入的目录路径必须以```"/"```收尾：

```js
module.exports = {
    cache: {
        type: 'filesystem',
        buildDependencies: {
            importantDependency: ['important-folder/']
        }
    }
}
```



当传入一个文件时，不仅所指定的文件本身会成为缓存的依赖，其通过模块导入的问价也会成为缓存的依赖。

比如说，Webpack推荐将其配置文件传入```cache.buildDependencies```。如：

```js
module.exports = {
    cache: {
        type: 'filesystem',
        buildDependencies: {
            myWebpackConfig: [__filename], // 当前webpack配置文件的位置
        }
    }
}
```

假如我们在webpack配置文件中使用了```mini-css-extract-plugin```，那么这么模块也会成为缓存的依赖，升级它会导致旧的缓存失效，这其实是符合预期的，因为webpack所依赖的模块很多都是会直接影响到打包结果的。



==缓存的目录==

在启用文件系统缓存后，webpack会把缓存放在一个指定的目录下，每当检测到源代码有所改变后，就会生成一个新版本的缓存。

Webpack会默认使用```${config.name}-${config.mode}```这样的目录形式，这是因为假如在实际工作中我们有```development```和```production```两种模式，假如我们现在development模式调试，再用production模式打包，production模式下生存的缓存将之前的development模式下生成的缓存覆盖掉，而在develop模式开发时，又要重新生成缓存，这种模式的切换就会导致缓存的互相覆盖，这增加了很多额外的工作量。

其中，```${config.name}```是我们通过```webpack.config.js```进行配置的，而```${config.mode}```则可以使同一份代码在不同模式下打包生成的缓存放在不同的目录里。



==版本更新==

类似于buildDependencies的工作原理，可以将工程中有可能影响到代码结果的因素纳入```${config.name}```中来。例如，我们项目需要泡在不同的Node.js版本中，这时可以在执行打包脚本时获取Node.js版本并赋值给```${config.name}```。这样对于每个版本的Node.js我们都会有一个单独的缓存目录。

```js
module.exports = {
    name: 'nodejs-${process.version}',
    cache: {
        type: 'filesystetm',
        cacheDirectory: path.resolve(__dirname, '.temp_cache'),
    }
}
```

##  模块打包

webpack在模块打包阶段，会生成一个个类的实例，用他们来帮助完成打包工作。

### Compiler

作用：

1. ==webpack的核心类，是webpack内外连接的桥梁，会接收外部传进来的配置项，也会向外暴露诸如run、watch等重要方法。==第三方插件修改webpack打包流程都要经过Compiler。compiler只会生成一个实例，所以只修改配置项是不会不生效的，需要重新启动webpack，生成新的Compiler类后生效。
2. ==Compiler控制着总任务流，通过提供工作流的钩子，插件监听到相关hook后进行工作。==![1](image/1.jpg)

大体结构类似如下：

```js
class Compiler {
    // ...
    run() {
        this.hooks.beforeRun.callAsync(this, err => {
            // ...
            this.hooks.run.callAsync(this, err => {
               // ...
                this.hooks.beforeCompile.callAsync(this, err => {
                    // ...
                    this.hooks.compile.callAsync(this, err =》 {
                         // ...
                    })
                })
            });
        })
    }
}
```

其他模块会去监听hooks，比如Webpack内部的ProgressPlugin，其负责在打包流程中展示进度信息。其代码如下示例：

```js
class ProgressPlugin {
    // ...
    _applyOnCompiler(compiler) {
        interceptHook(compiler.hooks.beforeRun, 0.02, 'setup', 'before run');
        interceptHook(compiler.hooks.run, 0.03, 'setup', 'run');
        interceptHook(compiler.hooks.compile, 0.07, 'setup', 'compile');
        // ...
        interceptHook(compiler.hooks.done, 0.99, 'done', 'plugins');
    }
}
```

这种通过hook方法进行流程管理的方式贯穿了整个Webpack内部的实现，它使每一个模块更便于单独管理，并且是可替代的，给Webpack带来了更强的灵活性和可维护性。

### Compilation

Compilation在webpack中也是处于核心地位，其类似于总管，管理着更底层的任务，比如创建依赖关系图，单个模块的处理以及模版渲染等。

Compilation的工作模式与Compiler类似， 也提供了非常多的Hook让其他模块监听和处理为更小的事务。

我们可以发现Compiler中有一个compilation的Hook，其触发的实际是在compilation创建后。假如现在编写一个新的webpack插件去监听compilation中的Hook，则必须先监听Compiler中的compilation这个Hook，然后从中获取到compilation对象，才能进行后续的处理。

### Resolver

初始化Compiler和Compilation实例实际打包流程的开始，下一步是构建依赖关系图。

Resolver会根据拿到webpack配置的入口路径找到对应的文件，同时由入口文件所获取到的依赖关系也需要Resolve来找到实际的文件路径。Resolve也会去解析各种不同的依赖语句。

Resolve找到了这个文件后，会返回一个对象，包含了resolve行为的所有信息，包括源代码的引用路径，最后实际找到的文件路径及其上下文。

Resolve得到信息并不包括源代码，实际的内容会从模块工厂中获取到。

![1](image/1-1730539169058-1.jpg)

### Module Factory

Module Factory(模块工厂)，最主要作用是产出模块。Module Factory的工厂模式类似一个函数，接收的是resolve提供的resolve行为信息，返回一个模块对象，模块对象中包含其源代码。

![76e464b99fd66084516fc50cc4d9032](image/76e464b99fd66084516fc50cc4d9032.jpg)

Module Factory也参与了模块级别的流程调度，他暴露出了很多hook，以便对单个模块进行处理。Resolve和parse都会监听Module Factory暴露出来的Hook。

### Parse

从Module Factory中得到的源代码是各种各样的，可能包含最新的ECMAScript特性，也可能是异步加载的语法引入其他模块，甚至可能完全是一个新的语言。面对如此多类型的源代码，必须让他编程webpack能理解的形式才能进行下一步处理，而这就是Parse的工作。Parse接收由Module.Factory产出的模块对象，通过Webpack配置的模块处理规则，让不同类型的源代码经loader的处理最终都变成JavaScript。

在将源代码转译成Javascript之后，Parse还要进行另一项重要工作，就是将JavaScript转化成抽象语法树(AST)，并进一步寻找文件依赖。



例子：

假如工程中只有两个src/index.js和src/utils.js两个源文件。

```js
// index.js
import { sum } from './util.js'
console.log('[ sum ] >', sum(2, 3))

// utils.js
export.sum = (a, b) => {
    return a + b
}
```

假设index.js为工程的入口文件，当Parse处理到该文件时，并不是通过直接运行index.js的代码来获取它与utils.js存在依赖，而是先将其解析为AST，再对AST进行分析。

例如对index.js的解析([AST explorer](https://astexplorer.net/))：

```js
import { sum } from './util.js'
console.log('[ sum ] >', sum(2, 3))
```

![1730593975922](image/1730593975922.png)

由源代码生产的AST可以看出，AST分析了源代码由一个依赖声明(Import Declaration)和一个表达式语句(Expression Statement)构成的。依赖生命语句中进一步包括语法分析得到的路径值，并由此得出它与./urils存在依赖关系。

### 工作流程

在经过Resolve、ModuleFactory、Parse处理后的源文件包括一下信息：

+ index,js是否存在，以及它的位置
+ index,js的源代码
+ index.js经过loader处理后的代码
+ index.js的依赖

整体工作流程如下

![b4c23680b5e3cb07c44be6bce91f599](image/b4c23680b5e3cb07c44be6bce91f599.jpg)

其中resolve的角色是解析依赖关系，寻找文件，入口文件index.js经由resolve找到后，ModuleFactory处理返回一个模块对象其中包括源代码，再交由parse处理，parse一是根据配置处理源代码，而是将其解析成AST树，可以获取其中依赖关系util.js，再交由resolve处理，经历上面环节。

### 模板渲染

在由入口index.js开始找到的所有的模块都处理完毕后，webpack会把这些模块封装在一起，并生成一个chunk。当然这里可能有一些特殊的处理，比如异步加载的模块可能会被分为单独的chunk，或者某些模块匹配到splitChunkPlugin规则后又生产了一个chunk。这些chunk都等待着被转化为最后的代码，而webpack实现这最后一步的方法就是模版渲染。

比如，我们日常使用的模版渲染可能是用来将一些动态数据放在HTML页面中，如：

```html
<p>
    {{ firstname }} {{ lastname }}
</p>
```

在webpack中也是类似，目标是渲染出来的是目标代码，比如上面的index.js和util.js，渲染结果可能如下：

```js
/******/ // ......
/******/ var __webpack_exports__ = __webpack_require__("./src/index.js")
```

而实际上是由 以下的模版渲染来的

```js
/******/ // ......
/******/ var __webpack_exports__ = __webpack_require__("${moduleIdExpr}")
```

对于不同类型的模块以及模块之间的依赖关系，webpack内部都有像对应的模板。根据依赖关系图及前面步骤得到的模块信息，webpack进行组织和瓶装模版，再把实际模块相关的内容装进去，最后就渲染出了我们所看到目标代码。

## 插件

webpack整体架构的实现就是靠他的插件系统。Compiler和Compilation作为调度者管理者着构建的流程，同时暴露出一些Hook，然后由哥哥负责不同职责的插件来监听这些Hook，并完成具体工作。下面是webpack插件西永运行机制。

### Tapable

Tapable是整个webpack插件系统的核心。tap本身有监听的意思，tapable的意思则是可以监听的。tapable在webpack中是一个类，所有由这个类产生的实例都是可以被监听的。而所有的webpack中的插件，甚至包括ompiler和Compilation，都继承了Tapable这个类。（在webpack5中为了拓展内部实现，已经不再直接继承Tapable，但依然可以使用相同api）

下面是一个webpack插件的最简单实现:

```js
class MySyncWebpackPlugin {
    apply(compiler) {
        compiler.hooks.afterResolvers.tap('MySyncWebpackPlugin', (compiler) => {
            console.log('[compiler] >', compiler)
        })
    }
}
```

插件会监听compiler提供的钩子。监听了afterResolvers这个钩子，第一个参数是插件的名字，便于代码调试和webpack收集构建的相关的额数据，第二个参数是回调函数。

另一个例子：

```js
class MyAsyncWebpackPlugin {
    apply(compiler) {
        compiler.hooks.done.tapAsync(
        	'MyAsyncWebpackPlugin',
            (stats, cb) => {
                setTimeoue(() => {
                    console.log('[ stats ] >', stats)
                    cb()
                }, 1000)
            }
        )
    }
}
```

具体使用哪个方法来监听取决于该Hook在webpack内部是如何定义的。

| Hook类型                   | 监听方法                |
| -------------------------- | ----------------------- |
| SyncHook                   | tap                     |
| SyncBailHook               | tap                     |
| SyncWaterfallHook          | tap                     |
| AsyncSeriesHook            | tap/tapAsync/tapPromise |
| AsyncSeriesWaterfallHoolll | tap/tapAsync/tapPromise |
| AsyncSeriesBailHook        | tap/tapAsync/tapPromise |
| AsyncParalleHook           | tap/tapAsync/tapPromise |

使用tap的方法时，回调函数仅可以包含由hook提供的参数，且只允许执行同步逻辑。在webpack中每个Hook都会 通过回调函数的参数提供与该Hook相关的资源或数据。比如前面hooks.afterResolves对应的compiler。也有少数Hook不提供参数。

tapAsync方法允许执行异步逻辑，最后通过参数中的callback函数结束插件的执行。比如上面MyAsyncWebpackPluygn中使用了setTimeout，并使其等待1秒之后返回结果。

tapPromise基本上只是tapAsync的另一种写法。

在webpack(https://webpack.js.org/api/compiler-hooks/)，我们不但可以找到Compil、compilation这些调度者暴露了哪些Hook，还可以找到每个Hook所属的类型，只要使用相对应的监听方法就可。

### 插件的协同方式

有些插件同步执行，也有些插件可以执行异步任务，那么有些问题：

+ 插件的执行方式不同，插件之间是如何配合的
+ 执行了同一个Hook的不同插件的执行顺序是怎样的
+ 对于监听了同一个Hook的不同插件来说，引入的顺序和触发顺序有怎样的关系



对于绝大多数的Hook来说，同一时刻只允许有一个插件在工作，在上一个插件被触发而未执行完其逻辑前，下一个插件不会被触发。

```js
// ./build-utils/PluginA.js
module.exports = class PluginA {
    apply(compiler) {
        compiler.hooks.done.tapAsync('pluginA', (stats, cb) => {
            setTimeout(() => {
                console.log('[ PluginA ]')
                cb()
            }, 10000)
        })
    }
}

// ./build-utils/PluginB.js
module.exports = class PluginB {
    apply(compiler) {
        compiler.hooks.done.tap('pluginB', (stats) => {
            console.log('[ PluginB ]')
        })
    }
}

// webpack.config.js
module.exports = {
    // ...
    plugins: [
        new PluginA(),
        new PluginB()
    ]
}
```

我们在webpack中放置了两个插件，第一个插件会异步执行，并在十秒后输出PluginA;第二个插件会同步执行，并输出pluginB。在实际运行打包命令时，在十秒内不会以后任何输出，十秒后先输出PluginA再输出pluginB,这表示即便插件运行被异步执行，也是会有阻塞性。

这其实是非常正常的，因为webpack中所有的构建任务基本都是要靠插件来完成，如果每个插件都可以随时操作Compiler、Compilation的实例对象，很容易造成不可预知的相互影响。而若插件执行的顺序是固定的，整个流程的管理会相对容易多。

那么对监听了同一个Hook的不同插件来说，引入的顺序就是执行的顺序。

不过也有特殊情况，当hook的类型为AsyncParallelHook时，不同的插件是可以并行执行任务的。

| Hook类型                   | 监听方法                | 是否可并行 |
| -------------------------- | ----------------------- | ---------- |
| SyncHook                   | tap                     | 否         |
| SyncBailHook               | tap                     | 否         |
| SyncWaterfallHook          | tap                     | 否         |
| AsyncSeriesHook            | tap/tapAsync/tapPromise | 否         |
| AsyncSeriesWaterfallHoolll | tap/tapAsync/tapPromise | 否         |
| AsyncSeriesBailHook        | tap/tapAsync/tapPromise | 否         |
| AsyncParalleHook           | tap/tapAsync/tapPromise | 是         |

Hook类型的名字代表了他的特性，

+ Sync Async代表了是否可以执行异步逻辑
+ Parallel代表多个插件可以并行执行任务

+ Bail代表当一个Hook有多个插件监听时，一旦有一个插件返回了非undefined的值，该Hook就会提前终止，即便后面有其他的插件也不会继续执行了。该Hook可以用于进行一些条件判断。如Compiler内部的shouldEmitt这个hook，他可以通过多个插件来执行不同的检查，只要每一个插件的检查通过了，才代表shouldEmit返回了true。而其中一个插件返回了任意结果，即代表检查失败，shouldEmit为false，后面的插件也不会再执行了
+ Waterfall关键字代表前一个插件的结果是后一个插件的输入。例如下面的例子。这类hook适用于多个插件按照流水线的方式工作的场景。
+ Series和Async在一起，意思是逐个地执行异步任务。ComPiler和ComPilation中有很大一部分Hook类型都是AsyncSeriesHook，主要是该类型的Hook提供了非常大的灵活性。监听该类型Hook的插件既可以使用tap执行异步操作。也可以是tapAsync或tapPromise来执行异步方法、

```js
// ./build-utils/PluginA.js
module.exports = class PluginA {
    apply(compiler) {
        compiler.hooks.compilation.tap('pluginA', (compilation) => {
            compilation..hooks.assetPath.tap('pluginA',
            	(path, options) => {
    				console.log('[ pluginA Path ]', path)   
                	return path + 'A'
	            }
            )
        })
    }
}

// ./build-utils/PluginB.js
module.exports = class PluginB {
    apply(compiler) {
        compiler.hooks.compilation.tap('pluginB', (compilation) => {
            (path, options) => {
    			console.log('[ pluginB Path ]', path)   
                return path
	        }
        })
    }
}

// webpack.config.js
module.exports = {
    // ...
    plugins: [
        new PluginA(),
        new PluginB()
    ]
}
```

在上面例子中pluginB拿到的path为A自定义的。

# 11. Vue打包

 基础配置

```
mkdir vue-webpack-project
cd vue-webpack-project
npm init -y
npm i webpack webpack-cli -D
```

创建配置文件```webpack.config.js```

```js
// ./webpack.config.js
module.exports = () => {
  return {
    mode: 'development'
  }
}
```

创建src目录，并添加出示文件```index.js```

```js
// ./src/index.js
console.log('hello webpack!')
```

在创建后执行```npx webpack```命令，现在项目成功打包。

![1730639452891](D:/学习/study_md/image/1730639452891.png)



但项目还无法运行在浏览器中，我们使用webpack-dev-server html-webpack-plugin来启动web服务和打开浏览器页面。

```
npm i webpack-dev-server html-webpack-plugin -D
```

给html-webpack-plugin指定模版，在项目目录下添加index.html

```html
<!-- ./index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>vue-webpack-project</title>
</head>
<body>
  <div class="app"></div>
</body>
</html>
```

修改```webpack.config.js```

```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
module.exports = () => {
    return {
        devServer: {
            open: true,
            port: 3000,
        },
        mode: 'development',
        plugins: [
            new HtmlWebpackPlugin({ template: 'index.html'})
        ]
    }
}
```



启动命令```npx webpack serve```成功打开浏览器，并且控制台打印。

为了方便命令的执行，我们可以在package.json里配置启动命令

```js
// ./package.json
{
    ......
    "scripts": {
    	"test": "echo \"Error: no test specified\" && exit 1",
    	"dev": "webpack serve --env development",
    	"build": "webpack build --env production"
  	},
    ......
}
```

在```webpack.config.js```里来接收环境变量

```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const isProduction = process.env.NODE_ENV === 'production'
module.exports = () => {
    return {
        devServer: {
            open: true,
            port: 3000,
        },
        mode: isProduction ? 'production' : 'development',
        plugins: [
            new HtmlWebpackPlugin({ template: 'index.html'})
        ]
    }
}
```

这样我们只需要输入```npm run dev```或```npm run build```命令就可以了。



接下来配置处理JavaScript,使用```babel-loader```及相关的包

```
npm i -D babel-loader @babel/core @babel/preset-env @babel/pluign-transform-runtime
```

+ @babel/core babel的核心代码
+ @babel/preset-env 转移到ES6+代码到一个向下兼容的版本，并可以指定兼容哪些特定环境
+ @babel/pluign-transform-runtime 帮助babel减少重复代码，缩小资源体积

添加Babel的配置文件```babel.config.js```

```js
// ./babel.config.js
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        modules: false,
      }
    ]
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
  ]
}
```

修改```webpack.config.js```

```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const isProduction = process.env.NODE_ENV === 'production'
module.exports = () => {
    return {
        devServer: {
            open: true,
            port: 3000,
        },
        mode: isProduction ? 'production' : 'development',
        module: {
          rules: [
            {
              test: /.js$/,
              exclude: /node_modules/,
              use: {
                loader: 'babel-loader',
                options: {
                  cacheDirectory: true,
                  cacheCompression: false,
                }
              }
            }
          ]
        },
        plugins: [
            new HtmlWebpackPlugin({ template: 'index.html'})
        ]
    }
}
```



```
npm i -D @babel/core @babel/cli
```

创建```.babelrc```配置文件，并配置转换规则

```js
{
  "presets": ["@babel/preset-env"]
}
```

# 12 印客

## 

