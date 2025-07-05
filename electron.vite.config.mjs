import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import tailwindcss from '@tailwindcss/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import { bytecodePlugin } from 'electron-vite'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      minify: 'esbuild',
      esbuild: {
        // 保留错误级别的日志，移除debug和info级别
        drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
        // 在生产环境中保留console.error和console.warn
        pure:
          process.env.NODE_ENV === 'production'
            ? ['console.log', 'console.debug', 'console.info']
            : []
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin(), obfuscatorPlugin()], // 移除bytecodePlugin，避免对preload脚本进行字节码处理
    build: {
      minify: false, // 完全禁用preload脚本的压缩
      rollupOptions: {
        external: [], // 确保没有外部化关键依赖
        output: {
          format: 'cjs', // 明确指定输出格式
          inlineDynamicImports: true // 内联动态导入
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@preload': resolve('src/preload'),
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      vue(),
      tailwindcss(),
      AutoImport({
        // Auto import functions from Vue, e.g. ref, reactive, toRef...
        // 自动导入 Vue 相关函数，如：ref, reactive, toRef 等
        imports: ['vue'],

        // Auto import functions from Element Plus, e.g. ElMessage, ElMessageBox... (with style)
        // 自动导入 Element Plus 相关函数，如：ElMessage, ElMessageBox... (带样式)
        resolvers: [
          ElementPlusResolver(),

          // Auto import icon components
          // 自动导入图标组件
          IconsResolver({
            prefix: 'Icon'
          })
        ]
      }),
      Components({
        dirs: ['src/renderer/src/components'],
        resolvers: [
          // 自动注册图标组件
          IconsResolver({
            enabledCollections: ['ep']
          }),

          // 自动注册 Element Plus 组件
          ElementPlusResolver()
        ]
      }),
      createSvgIconsPlugin({
        // Specify the icon folder to be cached
        iconDirs: [path.resolve(process.cwd(), 'src/renderer/src/icons')],
        // Specify symbolId format
        symbolId: 'icon-[dir]-[name]'
      })
    ],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('element-plus')) return 'vendor-element-plus'
              if (id.includes('vue')) return 'vendor-vue'
              return 'vendor'
            }
            if (id.includes('/src/renderer/src/views/')) return 'views'
            if (id.includes('/src/renderer/src/components/')) return 'components'
          }
        }
      }
    }
  }
})
