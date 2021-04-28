var PolygonsRender = function (params) {

	params = params || {};

	this._handler = null;
	this._framebuffer = null;
	this._width = params.width || 256;
	this._height = params.height || 256;

	this._textureAtlas = null;

	this._vesselTypeImage = {};

	this._ready = false;
};

PolygonsRender.prototype = {

	//appendStyles: function (arr) {
	//    var ta = this._textureAtlas;
	//    var _this = this;
	//    arr.forEach(function (it, i) {
	//        var img = it.RenderStyle.image;
	//        if (img) {
	//            var canvas = document.createElement('canvas');
	//            canvas.width = img.width;
	//            canvas.height = img.height;
	//            canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height);

	//            ta.loadImage(canvas.toDataURL(), function (img) {
	//                _this._vesselTypeImage[i] = img;
	//                ta.addImage(img);
	//                ta.createTexture();
	//            });
	//        }
	//    });
	//},

	isReady: function() {
		return this._ready;
	},

	initialize: function () {

		this._handler = new gmxWebGL.Handler(null, {
			width: this._width,
			height: this._height,
			context: {
				alpha: true,
				depth: true
			}
		});
		this._handler.initialize();

		if (this._handler.gl) {

			// this._textureAtlas = new gmxWebGL.TextureAtlas(1024, 1024);
			// this._textureAtlas.assignHandler(this._handler);

			this._ready = true;
			this._handler.deactivateFaceCulling();
			this._handler.deactivateDepthTest();

			this._framebuffer = new gmxWebGL.Framebuffer(this._handler, {
				width: this._width,
				height: this._height,
				useDepth: false,
				filter: "LINEAR"
			});

			this._framebuffer.init();

			this._handler.addProgram(new gmxWebGL.Program("billboard", {
				uniforms: {
					'extentParams': { type: 'vec4' }
				},
				attributes: {
					'coordinates': { type: 'vec2' }
					// ,
					// 'colors': { type: 'vec4' }
				},
				// vertexShader: `attribute vec2 coordinates; 
						  // attribute vec4 colors; 
						  // uniform vec4 extentParams; 
						  // varying vec4 color;
						  // void main() { 
							  // color = colors;
							  // gl_Position = vec4((-1.0 + (coordinates - extentParams.xy) * extentParams.zw) * vec2(1.0, -1.0), 0.0, 1.0); 
						  // }`,
				// fragmentShader: `precision highp float;
							// varying vec4 color;
							// void main () {  
								// gl_FragColor = color; 
							// }`
				vertexShader: `attribute vec2 coordinates; 
						  uniform vec4 extentParams; 
						  void main() { 
							  gl_Position = vec4((-1.0 + (coordinates - extentParams.xy) * extentParams.zw) * vec2(1.0, -1.0), 0.0, 1.0); 
						  }`,
				fragmentShader: `precision highp float;
							void main () {  
								gl_FragColor = vec4(1, 0, 0, 1); 
							}`
			}));
		}
	},

	_createBuffers: function (tileData, layerName) {

		var h = this._handler,
			gl = h.gl;

		var geoItems = tileData.geoItems,
			length = geoItems.length;
/*

		gl.deleteBuffer(this._a_vert_tex_buffer);
		gl.deleteBuffer(this._a_lonlat_rotation_buffer);
		gl.deleteBuffer(this._a_size_offset_buffer);

		this._a_vert_tex_bufferArr = new Float32Array(length * 24);
		this._a_size_offset_bufferArr = new Float32Array(length * 24);
		this._a_lonlat_rotation_bufferArr = new Float32Array(length * 18);

		var v = this._a_vert_tex_bufferArr,
			c = this._a_lonlat_rotation_bufferArr,
			s = this._a_size_offset_bufferArr;

		var dx = 0.0, dy = 0.0;
*/
		var	LL = geoItems[0].properties.length - 1;

		// var vti = this._vesselTypeImage;
		// var ta = this._textureAtlas;

		// console.time("_createBuffers");

		var maxX = tileData.topLeft.bounds.max.x,
			minX = tileData.topLeft.bounds.min.x;

		this._polyVerticesMerc = [];
		this._polyIndexes = [];

		for (var i = 0; i < length; i++) {

			var prop = geoItems[i].properties,
				nm = geoItems[i].item.currentFilter;
			var geo = prop[LL];
			var coords = geo.coordinates;
			if (geo.type === 'POLYGON') {
				coords = [coords];
			}
			coords.forEach(arr => {
				let data = gmxWebGL.flatten(arr);
				
					// data.holes = [];
				if (data.holes.length) {
					console.log("holes", data);
				}
				let dataIndexes = gmxWebGL.earcut(data.vertices, data.holes, 2);
				for (let j = 0; j < dataIndexes.length; j++) {
					this._polyIndexes.push(dataIndexes[j] + this._polyVerticesMerc.length * 0.5);
				}

				this._polyVerticesMerc = this._polyVerticesMerc.concat(data.vertices);
				// this._polyIndexes = this._polyIndexes.concat(indexes);
			});
		}
		this._polyVerticesBufferMerc = h.createArrayBuffer(new Float32Array(this._polyVerticesMerc), 2, this._polyVerticesMerc.length / 2);
		this._polyIndexesBuffer = h.createElementArrayBuffer(new Uint32Array(this._polyIndexes), 1, this._polyIndexes.length);

		// console.timeEnd("_createBuffers");
	},

	render: function (outData, tileData, layer) {

		this._createBuffers(tileData, layer.options.layerID);

		var h = this._handler,
			gl = h.gl;

		h.programs.billboard.activate();
		var sh = h.programs.billboard._program;
		var sha = sh.attributes,
			shu = sh.uniforms;

		this._framebuffer.activate();

		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);

		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		var b = tileData.topLeft.bounds;

		gl.uniform4fv(shu.extentParams, new Float32Array([b.min.x, b.min.y, 2.0 / (b.max.x - b.min.x), 2.0 / (b.max.y - b.min.y)]));


		gl.bindBuffer(gl.ARRAY_BUFFER, this._polyVerticesBufferMerc);
		gl.vertexAttribPointer(sha.coordinates, this._polyVerticesBufferMerc.itemSize, gl.FLOAT, false, 0, 0);

		// gl.bindBuffer(gl.ARRAY_BUFFER, geomHandler._polyColorsBuffer);
		// gl.bindBuffer(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 0]));
		// gl.vertexAttribPointer(sha.colors, 4, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._polyIndexesBuffer);

		gl.drawElements(gl.TRIANGLES, this._polyIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);
console.log('numItems:', this._polyIndexesBuffer.numItems);


		this._framebuffer.deactivate();

		return this._framebuffer.readAllPixels(outData);
	}
};
