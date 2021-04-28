var PolylineRender = function (params) {

	params = params || {};

	this._handler = null;
	this._framebuffer = null;
	this._width = params.width || 256;
	this._height = params.height || 256;

	this._textureAtlas = null;

	this._vesselTypeImage = {};

	this._ready = false;
};

PolylineRender.prototype = {

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

	clearTextureAtlas: function() {
		if (this._textureAtlas) {
			this._textureAtlas.clear();
		}
	},

	appendStyles_old: function (styles, layer) {

		var ta = this._textureAtlas;

		var _this = this;

		for (var i = 0; i < styles.length; i++) {

			var si = styles[i];

			(function (style, index) {

				var f = style.Filter,
					t;
				//if (!f) {
				//    t = "unknown";
				//} else {
				//    t = f.split('=')[1].trim();
				//    t = t.substr(1, t.length - 2);
				//}

				var src = style.RenderStyle.iconUrl;

				var img = new Image();
				img.crossOrigin = '';

				img.onload = function () {

					var canvas = document.createElement('canvas');
					canvas.width = this.width;
					canvas.height = this.height;
					canvas.getContext("2d").drawImage(img, 0, 0, this.width, this.height);

					var layerName = layer.options.layerID;

					ta.loadImage(canvas.toDataURL(), function (img) {
						if (!_this._vesselTypeImage[layerName]) {
							_this._vesselTypeImage[layerName] = [];
						}
						_this._vesselTypeImage[layerName][index] = img;
						ta.addImage(img);
						ta.createTexture();
					});
				};

				img.src = src;

			})(si, i);

		}
	},

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

			this._textureAtlas = new gmxWebGL.TextureAtlas(1024, 1024);
			this._textureAtlas.assignHandler(this._handler);

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
					'viewport': { type: 'vec2' },
					'thicknessOutline': { type: 'FLOAT' },
					'alpha': { type: 'FLOAT' },
					'extentParams': { type: 'vec4' },
					// 'color': { type: 'vec4' },
					'thickness': { type: 'FLOAT' }
				},
				attributes: {
					'prev': { type: 'vec2' },
					'current': { type: 'vec2' },
					'next': { type: 'vec2' },
					'order': { type: 'FLOAT' }
				},
				vertexShader: `attribute vec2 prev;
						attribute vec2 current;
						attribute vec2 next;
						attribute float order;
						uniform float thickness;
						uniform float thicknessOutline;
						uniform vec2 viewport;
						uniform vec4 extentParams;
						
						vec2 proj(vec2 coordinates){
							return vec2(-1.0 + (coordinates - extentParams.xy) * extentParams.zw) * vec2(1.0, -1.0);
						}
						
						void main(){
							vec2 _next = next;
							vec2 _prev = prev;
							if(prev == current){
								if(next == current){
									_next = current + vec2(1.0, 0.0);
									_prev = current - next;
								}else{
									_prev = current + normalize(current - next);
								}
							}
							if(next == current){
								_next = current + normalize(current - _prev);
							}
							
							vec2 sNext = proj(_next),
								 sCurrent = proj(current),
								 sPrev = proj(_prev);
							vec2 dirNext = normalize(sNext - sCurrent);
							vec2 dirPrev = normalize(sPrev - sCurrent);
							float dotNP = dot(dirNext, dirPrev);
							
							vec2 normalNext = normalize(vec2(-dirNext.y, dirNext.x));
							vec2 normalPrev = normalize(vec2(dirPrev.y, -dirPrev.x));
							vec2 d = (thickness + thicknessOutline) * 0.5 * sign(order) / viewport;
							
							vec2 m;
							if(dotNP >= 0.99991){
								m = sCurrent - normalPrev * d;
							}else{
								vec2 dir = normalPrev + normalNext;
								m = sCurrent + dir * d / (dirNext.x * dir.y - dirNext.y * dir.x);
								
								if( dotNP > 0.5 && dot(dirNext + dirPrev, m - sCurrent) < 0.0 ){
									float occw = order * sign(dirNext.x * dirPrev.y - dirNext.y * dirPrev.x);
									if(occw == -1.0){
										m = sCurrent + normalPrev * d;
									}else if(occw == 1.0){
										m = sCurrent + normalNext * d;
									}else if(occw == -2.0){
										m = sCurrent + normalNext * d;
									}else if(occw == 2.0){
										m = sCurrent + normalPrev * d;
									}
								}else if(distance(sCurrent, m) > min(distance(sCurrent, sNext), distance(sCurrent, sPrev))){
									m = sCurrent + normalNext * d;
								}
							}
							gl_Position = vec4(m.x, m.y, 0.0, 1.0);
						}`,
				fragmentShader: `precision highp float;
						uniform float alpha;
						void main() {
							gl_FragColor = vec4(1, 0, 0, alpha * 0.5);
						}`
			}));
		}
	},
/*
						uniform vec4 color;
							gl_FragColor = vec4(color.rgb, alpha * color.a);
	_createBuffers1___: function (tileData, layerName) {

		var h = this._handler,
			gl = h.gl;

    this._lineVerticesMerc = [];
    this._lineOrders = [];
    this._lineIndexes = [];

		gl.deleteBuffer(this._a_vert_tex_buffer);
		gl.deleteBuffer(this._a_lonlat_rotation_buffer);
		gl.deleteBuffer(this._a_size_offset_buffer);

		var geoItems = tileData.geoItems,
			length = geoItems.length;

		this._a_vert_tex_bufferArr = new Float32Array(length * 24);
		this._a_size_offset_bufferArr = new Float32Array(length * 24);
		this._a_lonlat_rotation_bufferArr = new Float32Array(length * 18);

		var v = this._a_vert_tex_bufferArr,
			c = this._a_lonlat_rotation_bufferArr,
			s = this._a_size_offset_bufferArr;

		var dx = 0.0, dy = 0.0;

		var VT = 5,
			LL = geoItems[0].properties.length - 1,
			ROT = 1;

		var vti = this._vesselTypeImage;
		var ta = this._textureAtlas;

		// console.time("_createBuffers");

		var maxX = tileData.topLeft.bounds.max.x,
			minX = tileData.topLeft.bounds.min.x;

		this._polyVerticesMerc = [];
		this._polyIndexes = [];

		for (var i = 0; i < length; i++) {

			var prop = geoItems[i].properties,
				nm = geoItems[i].item.currentFilter;
			var coords = prop[LL].coordinates;
			
            appendLineData([path], isClosed, this._lineVerticesMerc, this._lineOrders, this._lineIndexes);
			let data = gmxWebGL.flatten(coords);
				data.holes = [];
			let indexes = gmxWebGL.earcut(data.vertices, data.holes, 2);

			this._polyVerticesMerc = this._polyVerticesMerc.concat(data.vertices);
			this._polyIndexes = this._polyIndexes.concat(indexes);
		}
		this._polyVerticesBufferMerc = h.createArrayBuffer(new Float32Array(this._polyVerticesMerc), 2, this._polyVerticesMerc.length / 2);
		this._polyIndexesBuffer = h.createElementArrayBuffer(new Uint32Array(this._polyIndexes), 1, this._polyIndexes.length);

		// console.timeEnd("_createBuffers");
	},
	*/
	_createBuffers: function (tileData, layerName) {

		var h = this._handler,
			gl = h.gl;

		var geoItems = tileData.geoItems,
			length = geoItems.length;

		var	LL = geoItems[0].properties.length - 1;

		// console.time("_createBuffers5");

		var maxX = tileData.topLeft.bounds.max.x,
			minX = tileData.topLeft.bounds.min.x;

    this._lineVerticesMerc = [];
    this._lineOrders = [];
    this._lineIndexes = [];

		for (var i = 0; i < length; i++) {

			var prop = geoItems[i].properties,
				nm = geoItems[i].item.currentFilter;
			var geo = prop[LL];
			var coords = geo.coordinates;
			// if (geo.type === 'POLYGON') {
				// coords = [coords];
			// }
			coords.forEach(arr => {
				// let data = gmxWebGL.flatten(arr);
				
				// let dataIndexes = gmxWebGL.earcut(data.vertices, data.holes, 2);
				// for (let j = 0; j < dataIndexes.length; j++) {
					// this._polyIndexes.push(dataIndexes[j] + this._polyVerticesMerc.length * 0.5);
				// }

				// this._polyVerticesMerc = this._polyVerticesMerc.concat(data.vertices);
				// this._polyIndexes = this._polyIndexes.concat(indexes);
            appendLineData([arr], true, this._lineVerticesMerc, this._lineOrders, this._lineIndexes);
			});
		}
		// this._polyVerticesBufferMerc = h.createArrayBuffer(new Float32Array(this._polyVerticesMerc), 2, this._polyVerticesMerc.length / 2);
		// this._polyIndexesBuffer = h.createElementArrayBuffer(new Uint32Array(this._polyIndexes), 1, this._polyIndexes.length);
    this._lineVerticesBufferMerc = h.createArrayBuffer(new Float32Array(this._lineVerticesMerc), 2, this._lineVerticesMerc.length / 2);
    this._lineIndexesBuffer = h.createElementArrayBuffer(new Uint32Array(this._lineIndexes), 1, this._lineIndexes.length);
    this._lineOrdersBuffer = h.createArrayBuffer(new Float32Array(this._lineOrders), 1, this._lineOrders.length / 2);

		// console.timeEnd("_createBuffers5");
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


                        //vertex
                        var mb = this._lineVerticesBufferMerc;
                        gl.bindBuffer(gl.ARRAY_BUFFER, mb);
                        gl.vertexAttribPointer(sha.prev, mb.itemSize, gl.FLOAT, false, 8, 0);
                        gl.vertexAttribPointer(sha.current, mb.itemSize, gl.FLOAT, false, 8, 32);
                        gl.vertexAttribPointer(sha.next, mb.itemSize, gl.FLOAT, false, 8, 64);

                        //order
                        gl.bindBuffer(gl.ARRAY_BUFFER, this._lineOrdersBuffer);
                        gl.vertexAttribPointer(sha.order, this._lineOrdersBuffer.itemSize, gl.FLOAT, false, 4, 0);

                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._lineIndexesBuffer);

                        //PASS - stroke
                        gl.uniform1f(shu.thickness, 2);
                        // gl.uniform4fv(shu.color, style.strokeColor.toArray());
                        // gl.uniform4fv(shu.color, [255, 0, 0, 1]);

                        //Antialias pass
                        gl.uniform1f(shu.thicknessOutline, 2);
                        gl.uniform1f(shu.alpha, 0.54);
                        gl.drawElements(gl.TRIANGLE_STRIP, this._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);
                       //Aliased pass
                        gl.uniform1f(shu.thicknessOutline, 1);
                        gl.uniform1f(shu.alpha, 1.0);
                        gl.drawElements(gl.TRIANGLE_STRIP, this._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);

                        //PASS - inside line
                        gl.uniform1f(shu.thickness, 4);
                        // gl.uniform4fv(shu.color, [0, 255, 0, 1]);

                        //Antialias pass
                        gl.uniform1f(shu.thicknessOutline, 2);
                        gl.uniform1f(shu.alpha, 0.54);
                        gl.drawElements(gl.TRIANGLE_STRIP, this._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);
                        //
                        //Aliased pass
                        gl.uniform1f(shu.thicknessOutline, 1);
                        gl.uniform1f(shu.alpha, 1.0);
                        gl.drawElements(gl.TRIANGLE_STRIP, this._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);

                        //Outline picking pass
                        // f.bindOutputTexture(pickingMask);
                        // gl.uniform1f(shu.thicknessOutline, 8);
                        // gl.uniform4fv(shu.color, pickingColor);
                        // gl.drawElements(gl.TRIANGLE_STRIP, this._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);

console.log('numItems:', this._lineIndexesBuffer.numItems);


		this._framebuffer.deactivate();

		return this._framebuffer.readAllPixels(outData);
	}
};
/*
                        //==============
                        //Outline
                        //==============
                        hLine.activate();
                        sh = hLine._program;
                        sha = sh.attributes;
                        shu = sh.uniforms;

                        f.bindOutputTexture(texture);

                        gl.uniform2fv(shu.viewport, [width, height]);
                        gl.uniform4fv(shu.extentParams, extentParams);

                        //vertex
                        var mb = ti._lineVerticesBufferMerc;
                        gl.bindBuffer(gl.ARRAY_BUFFER, mb);
                        gl.vertexAttribPointer(sha.prev, mb.itemSize, gl.FLOAT, false, 8, 0);
                        gl.vertexAttribPointer(sha.current, mb.itemSize, gl.FLOAT, false, 8, 32);
                        gl.vertexAttribPointer(sha.next, mb.itemSize, gl.FLOAT, false, 8, 64);

                        //order
                        gl.bindBuffer(gl.ARRAY_BUFFER, ti._lineOrdersBuffer);
                        gl.vertexAttribPointer(sha.order, ti._lineOrdersBuffer.itemSize, gl.FLOAT, false, 4, 0);

                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ti._lineIndexesBuffer);

                        //PASS - stroke
                        gl.uniform1f(shu.thickness, style.strokeWidth);
                        gl.uniform4fv(shu.color, style.strokeColor.toArray());

                        //Antialias pass
                        gl.uniform1f(shu.thicknessOutline, 2);
                        gl.uniform1f(shu.alpha, 0.54);
                        gl.drawElements(gl.TRIANGLE_STRIP, ti._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);
                        //
                        //Aliased pass
                        gl.uniform1f(shu.thicknessOutline, 1);
                        gl.uniform1f(shu.alpha, 1.0);
                        gl.drawElements(gl.TRIANGLE_STRIP, ti._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);

                        //PASS - inside line
                        gl.uniform1f(shu.thickness, style.lineWidth);
                        gl.uniform4fv(shu.color, style.lineColor.toArray());

                        //Antialias pass
                        gl.uniform1f(shu.thicknessOutline, 2);
                        gl.uniform1f(shu.alpha, 0.54);
                        gl.drawElements(gl.TRIANGLE_STRIP, ti._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);
                        //
                        //Aliased pass
                        gl.uniform1f(shu.thicknessOutline, 1);
                        gl.uniform1f(shu.alpha, 1.0);
                        gl.drawElements(gl.TRIANGLE_STRIP, ti._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);

                        //Outline picking pass
                        f.bindOutputTexture(pickingMask);
                        gl.uniform1f(shu.thicknessOutline, 8);
                        gl.uniform4fv(shu.color, pickingColor);
                        gl.drawElements(gl.TRIANGLE_STRIP, ti._lineIndexesBuffer.numItems, gl.UNSIGNED_INT, 0);
*/
var appendLineData = function (pathArr, isClosed, outVertices, outOrders, outIndexes) {
    var index = 0;

    if (outIndexes.length > 0) {
        index = outIndexes[outIndexes.length - 5] + 9;
        outIndexes.push(index, index);
    } else {
        outIndexes.push(0, 0);
    }

    for (var j = 0; j < pathArr.length; j++) {
        var path = pathArr[j];
        var startIndex = index;
        var last;
        if (isClosed) {
            last = path[path.length - 1];
        } else {
            let p0 = path[0],
                p1 = path[1];
            last = [p0[0] + p0[0] - p1[0], p0[1] + p0[1] - p1[1]];
        }
        outVertices.push(last[0], last[1], last[0], last[1], last[0], last[1], last[0], last[1]);
        outOrders.push(1, -1, 2, -2);

        for (var i = 0; i < path.length; i++) {
            var cur = path[i];
            outVertices.push(cur[0], cur[1], cur[0], cur[1], cur[0], cur[1], cur[0], cur[1]);
            outOrders.push(1, -1, 2, -2);
            outIndexes.push(index++, index++, index++, index++);
        }

        var first;
        if (isClosed) {
            first = path[0];
            outIndexes.push(startIndex, startIndex + 1, startIndex + 1, startIndex + 1);
        } else {
            let p0 = path[path.length - 1],
                p1 = path[path.length - 2];
            first = [p0[0] + p0[0] - p1[0], p0[1] + p0[1] - p1[1]];
            outIndexes.push(index - 1, index - 1, index - 1, index - 1);
        }
        outVertices.push(first[0], first[1], first[0], first[1], first[0], first[1], first[0], first[1]);
        outOrders.push(1, -1, 2, -2);

        if (j < pathArr.length - 1) {
            index += 8;
            outIndexes.push(index, index);
        }
    }
};