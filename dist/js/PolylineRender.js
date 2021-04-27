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
					viewport: "vec2",
					proj: "mat4",
					view: "mat4",
					eyePositionHigh: "vec3",
					eyePositionLow: "vec3",
					uFloatParams: "vec2",
					thickness: "float",
					opacity: "float"
				},
				attributes: {
					prevHigh: "vec3",
					currentHigh: "vec3",
					nextHigh: "vec3",

					prevLow: "vec3",
					currentLow: "vec3",
					nextLow: "vec3",

					order: "float",

					color: "vec4"
				},

				vertexShader:
					`precision highp float;
                
                attribute vec3 prevHigh;
                attribute vec3 currentHigh;
                attribute vec3 nextHigh;
                
                attribute vec3 prevLow;
                attribute vec3 currentLow;
                attribute vec3 nextLow;

                attribute float order;

                attribute vec4 color;

                uniform float thickness;
                uniform mat4 proj;
                uniform mat4 view;
                uniform vec2 viewport;
                uniform vec3 eyePositionHigh;
                uniform vec3 eyePositionLow;
                uniform float opacity;

                varying vec4 vColor;
                varying vec3 vPos;
                varying vec3 uCamPos;
                
                const float NEAR = -1.0;
                
                vec2 getIntersection(vec2 start1, vec2 end1, vec2 start2, vec2 end2){
                    vec2 dir = end2 - start2;
                    vec2 perp = vec2(-dir.y, dir.x);
                    float d2 = dot(perp, start2);
                    float seg = dot(perp, start1) - d2;
                    float prl = seg - dot(perp, end1) + d2;
                    if(prl > -1.0 && prl < 1.0){
                        return start1;
                    }
                    float u = seg / prl;
                    return start1 + u * (end1 - start1);
                }
                
                vec2 project(vec4 p){
                    return (0.5 * p.xyz / p.w + 0.5).xy * viewport;
                }
                
                void main(){

                    uCamPos = eyePositionHigh + eyePositionLow;

                    vColor = vec4(color.rgb, color.a * opacity);

                    vec3 current = currentHigh + currentLow;

                    vPos = current;                    

                    mat4 viewMatrixRTE = view;
                    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                    vec3 highDiff, lowDiff;

                    highDiff = currentHigh - eyePositionHigh;
                    lowDiff = currentLow - eyePositionLow;
                    vec4 vCurrent = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    highDiff = prevHigh - eyePositionHigh;
                    lowDiff = prevLow - eyePositionLow;    
                    vec4 vPrev = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    highDiff = nextHigh - eyePositionHigh;
                    lowDiff = nextLow - eyePositionLow;    
                    vec4 vNext = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    /*Clip near plane, the point behind view plane*/
                    if(vCurrent.z > NEAR) {
                        if(vPrev.z < NEAR && abs(order) == 1.0){
                            vCurrent = vPrev + (vCurrent - vPrev) * (NEAR - vPrev.z) / (vCurrent.z - vPrev.z);
                        } else if(vNext.z < NEAR && abs(order) == 2.0){
                            vCurrent = vNext + (vCurrent - vNext) * (NEAR - vNext.z) / (vCurrent.z - vNext.z);
                        }
                    }
                    
                    vec4 dCurrent = proj * vCurrent;
                    vec2 _next = project(proj * vNext);
                    vec2 _prev = project(proj * vPrev);
                    vec2 _current = project(dCurrent);

                    if(_prev == _current){
                        if(_next == _current){
                            _next = _current + vec2(1.0, 0.0);
                            _prev = _current - _next;
                        }else{
                            _prev = _current + normalize(_current - _next);
                        }
                    }

                    if(_next == _current){
                        _next = _current + normalize(_current - _prev);
                    }
                    
                    vec2 sNext = _next,
                         sCurrent = _current,
                         sPrev = _prev;

                    vec2 dirNext = normalize(sNext - sCurrent);
                    vec2 dirPrev = normalize(sPrev - sCurrent);
                    float dotNP = dot(dirNext, dirPrev);
                    
                    vec2 normalNext = normalize(vec2(-dirNext.y, dirNext.x));
                    vec2 normalPrev = normalize(vec2(dirPrev.y, -dirPrev.x));
                    
                    float d = thickness * sign(order);
                    
                    vec2 m;
                    if(dotNP >= 0.99991){
                        m = sCurrent - normalPrev * d;
                    }else{
                        m = getIntersection( sCurrent + normalPrev * d, sPrev + normalPrev * d,
                                sCurrent + normalNext * d, sNext + normalNext * d );
                        
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

                    gl_Position = vec4((2.0 * m / viewport - 1.0) * dCurrent.w, dCurrent.z, dCurrent.w);
                }`,
				fragmentShader:
					`precision highp float;
                uniform vec2 uFloatParams;
                varying vec3 uCamPos;
                varying vec4 vColor;
                varying vec3 vPos;
                void main() {
                    vec3 look = vPos - uCamPos;
                    float lookLength = length(look);
                    float a = vColor.a * step(lookLength, sqrt(dot(uCamPos,uCamPos) - uFloatParams[0]) + sqrt(dot(vPos,vPos) - uFloatParams[0]));                    
                    gl_FragColor = vec4(vColor.rgb, a);
                }`
			}));
		}
	},

	_createBuffers: function (tileData, layerName) {

		var h = this._handler,
			gl = h.gl;

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


		for (var i = 0; i < length; i++) {

			var prop = geoItems[i].properties,
				nm = geoItems[i].item.currentFilter,
				lon = prop[LL].coordinates[0],
				lat = prop[LL].coordinates[1],
				// rot = prop[ROT];	// Вращение иконки
				rot = 0;

			if (maxX === 20037508.342789248 &&
				lon < 0.0) {
				lon = 20037508.342789248 + (lon + 20037508.342789248);
			}

			if (minX === -20037508.342789248 &&
				lon > 0.0) {
				lon = -20037508.342789248 - (20037508.342789248 - lon);
			}
			var img = vti[layerName] ? vti[layerName][nm] : vti.unknown;
			//var img = vti[prop[VT]] || vti.unknown;

			var _w = 0, _h = 0, tc;

			if (img) {
				_w = img.width;
				_h = img.height;
				tc = ta.getImageTexCoordinates(img);
			}

			if (!tc) tc = new Float32Array(12);

			var i24 = i * 24,
				i18 = i * 18;

			v[i24 + 0] = -0.5;
			v[i24 + 1] = -0.5;
			v[i24 + 2] = tc[0];
			v[i24 + 3] = tc[1];
			v[i24 + 4] = -0.5;
			v[i24 + 5] = 0.5;
			v[i24 + 6] = tc[2];
			v[i24 + 7] = tc[3];
			v[i24 + 8] = 0.5;
			v[i24 + 9] = 0.5;
			v[i24 + 10] = tc[4];
			v[i24 + 11] = tc[5];
			v[i24 + 12] = 0.5;
			v[i24 + 13] = 0.5;
			v[i24 + 14] = tc[6];
			v[i24 + 15] = tc[7];
			v[i24 + 16] = 0.5;
			v[i24 + 17] = -0.5;
			v[i24 + 18] = tc[8];
			v[i24 + 19] = tc[9];
			v[i24 + 20] = -0.5;
			v[i24 + 21] = -0.5;
			v[i24 + 22] = tc[10];
			v[i24 + 23] = tc[11];

			s[i24 + 0] = _w;
			s[i24 + 1] = _h;
			s[i24 + 2] = dx;
			s[i24 + 3] = dy;
			s[i24 + 4] = _w;
			s[i24 + 5] = _h;
			s[i24 + 6] = dx;
			s[i24 + 7] = dy;
			s[i24 + 8] = _w;
			s[i24 + 9] = _h;
			s[i24 + 10] = dx;
			s[i24 + 11] = dy;
			s[i24 + 12] = _w
			s[i24 + 13] = _h;
			s[i24 + 14] = dx;
			s[i24 + 15] = dy;
			s[i24 + 16] = _w;
			s[i24 + 17] = _h;
			s[i24 + 18] = dx;
			s[i24 + 19] = dy;
			s[i24 + 20] = _w;
			s[i24 + 21] = _h;
			s[i24 + 22] = dx;
			s[i24 + 23] = dy;

			c[i18 + 0] = lon;
			c[i18 + 1] = lat;
			c[i18 + 2] = rot;
			c[i18 + 3] = lon;
			c[i18 + 4] = lat;
			c[i18 + 5] = rot;
			c[i18 + 6] = lon;
			c[i18 + 7] = lat;
			c[i18 + 8] = rot;
			c[i18 + 9] = lon;
			c[i18 + 10] = lat;
			c[i18 + 11] = rot;
			c[i18 + 12] = lon;
			c[i18 + 13] = lat;
			c[i18 + 14] = rot;
			c[i18 + 15] = lon;
			c[i18 + 16] = lat;
			c[i18 + 17] = rot;
		}

		this._a_vert_tex_buffer = h.createArrayBuffer(v, 4, v.length / 4, gl.DYNAMIC_DRAW);
		this._a_size_offset_buffer = h.createArrayBuffer(s, 4, s.length / 4, gl.DYNAMIC_DRAW);
		this._a_lonlat_rotation_buffer = h.createArrayBuffer(c, 3, c.length / 3, gl.DYNAMIC_DRAW);
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


		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._textureAtlas.texture);

		gl.uniform1i(shu.u_texture, 0);

		var b = tileData.topLeft.bounds;

		gl.uniform4fv(shu.extentParams, new Float32Array([b.min.x, b.min.y, 2.0 / (b.max.x - b.min.x), 2.0 / (b.max.y - b.min.y)]));

		gl.bindBuffer(gl.ARRAY_BUFFER, this._a_vert_tex_buffer);
		gl.vertexAttribPointer(sha.a_vert_tex, this._a_vert_tex_buffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this._a_lonlat_rotation_buffer);
		gl.vertexAttribPointer(sha.a_lonlat_rotation, this._a_lonlat_rotation_buffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this._a_size_offset_buffer);
		gl.vertexAttribPointer(sha.a_size_offset, this._a_size_offset_buffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.TRIANGLES, 0, this._a_vert_tex_buffer.numItems);

		this._framebuffer.deactivate();

		return this._framebuffer.readAllPixels(outData);
	}
};
