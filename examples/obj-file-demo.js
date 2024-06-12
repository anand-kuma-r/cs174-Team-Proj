import {defs, tiny} from './common.js';
const {vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Shape_From_File extends Shape {
    constructor(filename) {
        super("position", "normal", "texture_coord");
        this.load_file(filename);
    }

    load_file(filename) {
        return fetch(filename)
            .then(response => response.ok ? response.text() : Promise.reject(response.status))
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                console.error(error);
                this.copy_onto_graphics_card(this.gl);
            });
    }

    parse_into_mesh(data) {
        const verts = [], vertNormals = [], textures = [], unpacked = {
            verts: [], norms: [], textures: [], hashindices: {}, indices: [], index: 0
        };

        const lines = data.split('\n');
        const VERTEX_RE = /^v\s/, NORMAL_RE = /^vn\s/, TEXTURE_RE = /^vt\s/, FACE_RE = /^f\s/, WHITESPACE_RE = /\s+/;

        for (let line of lines) {
            line = line.trim();
            const elements = line.split(WHITESPACE_RE).slice(1);

            if (VERTEX_RE.test(line)) verts.push(...elements.map(Number));
            else if (NORMAL_RE.test(line)) vertNormals.push(...elements.map(Number));
            else if (TEXTURE_RE.test(line)) textures.push(...elements.map(Number));
            else if (FACE_RE.test(line)) {
                let quad = false;
                for (let j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) { j = 2; quad = true; }
                    if (elements[j] in unpacked.hashindices) unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        const vertex = elements[j].split('/');
                        unpacked.verts.push(...verts.slice((vertex[0] - 1) * 3, (vertex[0] - 1) * 3 + 3));
                        if (textures.length) unpacked.textures.push(...textures.slice((vertex[1] - 1) * 2, (vertex[1] - 1) * 2 + 2));
                        unpacked.norms.push(...vertNormals.slice((vertex[2] - 1) * 3, (vertex[2] - 1) * 3 + 3));
                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }

        for (let j = 0; j < unpacked.verts.length / 3; j++) {
            this.arrays.position.push(vec3(unpacked.verts[3 * j], unpacked.verts[3 * j + 1], unpacked.verts[3 * j + 2]));
            this.arrays.normal.push(vec3(unpacked.norms[3 * j], unpacked.norms[3 * j + 1], unpacked.norms[3 * j + 2]));
            this.arrays.texture_coord.push(vec(unpacked.textures[2 * j], unpacked.textures[2 * j + 1]));
        }
        this.indices = unpacked.indices;
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {
        if (this.ready) super.draw(context, program_state, model_transform, material);
    }
}

export class Shape_From_File_with_MTL extends Shape {
    constructor(filename, mtl_filename = null) {
        super("position", "normal", "texture_coord");
        this.materials = {};
        this.shapes = {};
        this.materialOverrides = {};
        this.ready = false;
        this.gl = null;
        if (mtl_filename) {
            this.load_mtl_file(mtl_filename).then(() => this.load_file(filename));
        } else {
            this.load_file(filename);
        }
    }

    load_file(filename) {
        return fetch(filename)
            .then(response => response.ok ? response.text() : Promise.reject(response.status))
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                console.error(error);
                this.copy_onto_graphics_card(this.gl);
            });
    }

    load_mtl_file(filename) {
        return fetch(filename)
            .then(response => response.ok ? response.text() : Promise.reject(response.status))
            .then(mtl_file_contents => this.parse_into_mtl(mtl_file_contents))
            .catch(error => console.error(error));
    }

    parse_into_mtl(data) {
        const lines = data.split('\n');
        let currentMaterial = null;
    
        lines.forEach(line => {
            line = line.trim();
            if (line.length === 0 || line.startsWith('#')) return;
    
            const [keyword, ...args] = line.split(/\s+/);
            switch (keyword.toLowerCase()) {
                case 'newmtl':
                    currentMaterial = args[0];
                    this.materials[currentMaterial] = {};
                    break;
                case 'ka':
                    this.materials[currentMaterial].ambient = args.map(Number);
                    break;
                case 'kd':
                    this.materials[currentMaterial].diffuse = args.map(Number);
                    break;
                case 'ks':
                    this.materials[currentMaterial].specular = args.map(Number);
                    break;
                case 'ke':
                    this.materials[currentMaterial].emissive = args.map(Number);
                    break;
                case 'ni':
                    this.materials[currentMaterial].ior = Number(args[0]);  // index of refraction
                    break;
                case 'ns':
                    this.materials[currentMaterial].shininess = Number(args[0]);
                    break;
                case 'd':
                    this.materials[currentMaterial].opacity = Number(args[0]);
                    break;
                case 'illum':
                    this.materials[currentMaterial].illum = Number(args[0]);
                    break;
                case 'map_kd':
                    this.materials[currentMaterial].texture = `assets/${args.join('')}`;
                    break;
                default:
                    break;
            }
        });
    
        for (const matName in this.materials) {
            const mat = this.materials[matName];
            const diffuseColor = (mat.diffuse && mat.diffuse.length === 3) ? [...mat.diffuse, 1] : [1, 1, 1, 1];
            const ambientColor = (mat.ambient && mat.ambient.length === 3) ? [...mat.ambient, 1] : [0, 0, 0, 1];
            const specularColor = (mat.specular && mat.specular.length === 3) ? [...mat.specular, 1] : [0, 0, 0, 1];
            const emissiveColor = (mat.emissive && mat.emissive.length === 3) ? [...mat.emissive, 1] : [0, 0, 0, 1];
            const shininess = mat.shininess !== undefined ? mat.shininess : 40; // default shininess value
            const opacity = mat.opacity !== undefined ? mat.opacity : 1; // default opacity value
            const ior = mat.ior !== undefined ? mat.ior : 1.5; // default index of refraction
            const illum = mat.illum !== undefined ? mat.illum : 1; // default illumination model
    
            this.materialOverrides[matName] = new Material(new defs.Textured_Phong(1), {
                color: color(...diffuseColor),
                ambient: 1,
                diffusivity: .8,
                specularity: .8,
                texture: mat.texture ? new Texture(mat.texture) : null,
            });
        }
    }

    parse_into_mesh(data) {
        const verts = [], vertNormals = [], textures = [];
        const shapes = {};
        let currentShape = null;

        const lines = data.split('\n');
        const VERTEX_RE = /^v\s/, NORMAL_RE = /^vn\s/, TEXTURE_RE = /^vt\s/, FACE_RE = /^f\s/, OBJECT_RE = /^o\s/, USEMTL_RE = /^usemtl\s/, WHITESPACE_RE = /\s+/;

        for (let line of lines) {
            line = line.trim();
            const elements = line.split(WHITESPACE_RE);
            const keyword = elements.shift();

            if (VERTEX_RE.test(line)) verts.push(...elements.map(Number));
            else if (NORMAL_RE.test(line)) vertNormals.push(...elements.map(Number));
            else if (TEXTURE_RE.test(line)) textures.push(...elements.map(Number));
            else if (OBJECT_RE.test(line)) {
                currentShape = elements[0];
                shapes[currentShape] = { verts: [], norms: [], textures: [], indices: [], index: 0, hashindices: {}, material: null };
            } else if (USEMTL_RE.test(line)) {
                if (currentShape) shapes[currentShape].material = elements[0];
            } else if (FACE_RE.test(line) && currentShape) {
                let quad = false;
                for (let j = 0; j < elements.length; j++) {
                    if (j === 3 && !quad) { j = 2; quad = true; }

                    const vertex = elements[j].split('/');
                    const shape = shapes[currentShape];

                    if (elements[j] in shape.hashindices) {
                        shape.indices.push(shape.hashindices[elements[j]]);
                    } else {
                        const vertIndex = (vertex[0] - 1) * 3;
                        shape.verts.push(verts[vertIndex], verts[vertIndex + 1], verts[vertIndex + 2]);

                        if (textures.length) {
                            const texIndex = (vertex[1] - 1) * 2;
                            shape.textures.push(textures[texIndex], textures[texIndex + 1]);
                        }

                        const normIndex = (vertex[2] - 1) * 3;
                        shape.norms.push(vertNormals[normIndex], vertNormals[normIndex + 1], vertNormals[normIndex + 2]);

                        shape.hashindices[elements[j]] = shape.index;
                        shape.indices.push(shape.index);
                        shape.index += 1;
                    }
                    if (j === 3 && quad) shape.indices.push(shape.hashindices[elements[0]]);
                }
            }
        }

        for (const shapeName in shapes) {
            const shapeData = shapes[shapeName];
            const shape = new Shape("position", "normal", "texture_coord");
            shape.arrays.position = shapeData.verts.map((v, i) => i % 3 === 0 ? vec3(v, shapeData.verts[i + 1], shapeData.verts[i + 2]) : null).filter(v => v);
            shape.arrays.normal = shapeData.norms.map((n, i) => i % 3 === 0 ? vec3(n, shapeData.norms[i + 1], shapeData.norms[i + 2]) : null).filter(n => n);
            shape.arrays.texture_coord = shapeData.textures.map((t, i) => i % 2 === 0 ? vec(t, shapeData.textures[i + 1]) : null).filter(t => t);
            shape.indices = shapeData.indices;

            this.shapes[shapeName] = { shape, material: shapeData.material };
        }

        this.ready = true;
        //console.log('Parsed shapes:', this.shapes);
    }

    draw(context, program_state, model_transform, default_material) {
        if (!this.ready) return;

        for (const shapeName in this.shapes) {
            const { shape, material: material_name } = this.shapes[shapeName];
            let material = default_material;

            if (material_name && this.materialOverrides[material_name]) {
                material = this.materialOverrides[material_name];
            }

            //console.log("hey", material.texture);

            shape.copy_onto_graphics_card(context.context);
            shape.draw(context, program_state, model_transform, material);

            // Unbind texture to prevent leakage
            context.context.bindTexture(context.context.TEXTURE_2D, null);
        }
    }
}

export class Obj_File_Demo extends Scene {
    constructor() {
        super();
        this.shapes = {
            taxi: new Shape_From_File_with_MTL("assets/madchat.obj", "assets/madchat.mtl"),
            car: new Shape_From_File_with_MTL("assets/car.obj", "assets/car.mtl")
        };
        this.widget_options = { make_controls: false };
        this.default_material = new Material(new defs.Phong_Shader(), {
            color: color(1, 1, 1, 1),
            ambient: 0.3, diffusivity: .5, specularity: .5
        });
    }

    display(context, program_state) {
        const t = program_state.animation_time;

        program_state.set_camera(Mat4.translation(0, 0, -5));
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        program_state.lights = [new Light(
            Mat4.rotation(t / 300, 1, 0, 0).times(vec4(3, 2, 10, 1)),
            color(1, .7, .7, 1), 100000)];

        for (let i of [-1, 1]) {
            const model_transform = Mat4.rotation(t / 2000, 0, 2, 1)
                .times(Mat4.translation(2 * i, 0, 0))
                .times(Mat4.rotation(t / 1500, -1, 2, 0))
                .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0));
            this.shapes.taxi.draw(context, program_state, model_transform, this.default_material);
            this.shapes.car.draw(context, program_state, model_transform, this.default_material);
        }
    }

    show_explanation(document_element) {
        document_element.innerHTML += "<p>This demo loads an external 3D model file of a taxi. It uses a condensed version of the \"webgl-obj-loader.js\" open source library, though this version is not guaranteed to be complete and may not handle some .OBJ files. It is contained in the class \"Shape_From_File\".</p>";
    }
}
