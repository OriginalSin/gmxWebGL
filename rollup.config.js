import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
// import css from 'rollup-plugin-css-porter';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
// import {terser} from 'rollup-plugin-terser';

export default [
    {
        input: 'src/index.js',        
        output: { 
            file: 'dist/gmxWebGL.js',
            format: 'iife',
            sourcemap: true,
            name: 'gmxWebGL',
            globals: {
                'leaflet': 'L',
            },
        },
        plugins: [                      
            resolve({moduleDirectories: ['node_modules', 'src']}),
            commonjs(),
            json(),
            // css({dest: 'dist/gmxWebGL.css', minified: false}),
            babel({    
                babelHelpers: 'bundled',            
                extensions: ['.js', '.mjs'],
                exclude: ['node_modules/@babel/**', 'node_modules/core-js/**'],
                include: ['src/**', 'node_modules/**']
            }),
            // terser(),
        ],
    }, 
];