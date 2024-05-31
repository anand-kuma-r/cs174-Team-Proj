import { defs, tiny } from "./examples/common.js";

import { Shape_From_File } from "./examples/obj-file-demo.js";
const { Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene } = tiny;

export class Final_Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            //Final Project:
            road: new defs.Cube(),
            road_stripe: new defs.Cube(),
            desert: new defs.Cube(),
            car: new Shape_From_File("assets/taxi.obj"),
            boost: new defs.Cube(),
            truck: new Shape_From_File("assets/truck.obj"),
        };

        // *** Materials
        this.materials = {
            road_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#303030"), specularity: 0 }),
            road_stripe_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#FFFFFF"), specularity: 0 }),
            desert_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#E3CDA4"), specularity: 0 }),
            car_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#808080"), specularity: 0 }),
            truck_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#808080"), specularity: 0 }),
            boost_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#0096FF"), specularity: 0 }),
            // TODO:  Fill in as many additional material objects as needed in this key/value table.
        };

        this.constants = {
            ROAD_MAX_DISTANCE: 150,
            ROAD_MIN_DISTANCE: -90,
            ROAD_WIDTH: 18,
            STRIPE_WIDTH: 0.2,
            STRIPE_LENGTH: 3,
            BOOST_SIZE: 0.2,
        };

        this.game_state = {
            SPEED: 1, // a multiplier, i.e. 1 means normal speed, 2 means double speed, etc.
            CAR_LANE: 0, // -1 for left, 0 for center, 1 for right
            BOOST_LANE: Math.floor(Math.random() * 3) - 1, // -1 for left, 0 for center, 1 for right
            LAST_SPAWN_BOOST_TIME: 0, // Time of the last spawn
            BOOST_SPAWN_FREQUENCY: 10 * 1000, // 10 seconds is frequncy of boosts spawning
            BOOSTS: [], //stores the boosts
            BOOST_DURATION: 1 * 1000, // 1 second is duration of boost
            BOOST_SPEED_MULTIPLIER: 1.5,
            
            
            //For cars as obstacles generation
            OTHER_CARS: [],
            OTHER_CAR_SPAWN_FREQUENCY: 5000,
            LAST_SPAWN_CAR_TIME: 0,
            NEXT_SPAWN_TIME: 2000,
            OTHER_CAR_SPEED: 0.5,
        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 5, this.constants.ROAD_MIN_DISTANCE), vec3(0, 10, 50), vec3(0, 1, 0));
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        // this.key_triggered_button("View solar system", ["Control", "0"], () => this.attached = () => this.solar_system);
        // this.new_line();
        // this.key_triggered_button("Attach to planet 1", ["Control", "1"], () => this.attached = () => this.planet_1);
        // this.key_triggered_button("Attach to planet 2", ["Control", "2"], () => this.attached = () => this.planet_2);
        // this.new_line();
        // this.key_triggered_button("Attach to planet 3", ["Control", "3"], () => this.attached = () => this.planet_3);
        // this.key_triggered_button("Attach to planet 4", ["Control", "4"], () => this.attached = () => this.planet_4);
        // this.new_line();
        // this.key_triggered_button("Attach to moon", ["Control", "m"], () => this.attached = () => this.moon);
        this.key_triggered_button("Go right", ["ArrowRight"], () => {
            this.game_state.CAR_LANE = Math.min(this.game_state.CAR_LANE + 1, 1);
        });
        this.key_triggered_button("Go left", ["ArrowLeft"], () => {
            this.game_state.CAR_LANE = Math.max(this.game_state.CAR_LANE - 1, -1);
        });
    }



    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push((context.scratchpad.controls = new defs.Movement_Controls()));
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.1, 1000);


        // TODO: Lighting (Requirement 2)
        const light_position = vec4(0, 5, 5, 1);
        const sunlight_position = vec4(0, 0, 0, 1);
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // Road
        let road_transform = Mat4.identity();
        road_transform = Mat4.identity().times(Mat4.scale(this.constants.ROAD_WIDTH / 2, 1, this.constants.ROAD_MAX_DISTANCE));
        this.shapes.road.draw(context, program_state, road_transform, this.materials.road_mat);

        // Road stripes
        this.draw_road_stripes(context, program_state);
        

        // Car
        let car_transform = Mat4.identity();
        car_transform = Mat4.identity().times(Mat4.translation(-6 * this.game_state.CAR_LANE, 2.2, -75));
        car_transform = car_transform.times(Mat4.scale(2, 2.5, 3));
        this.shapes.car.draw(context, program_state, car_transform, this.materials.car_mat);

        let carPos = car_transform.times(vec4(0, 0, 0, 1)); // Multiply by a vector to get a vector
        let carPosX = carPos[0];
        let carPosY = carPos[1];
        let carPosZ = carPos[2];

        //desert
        let side1_transform = Mat4.identity();
        side1_transform = Mat4.identity().times(Mat4.translation(1, -0.01, 0));
        side1_transform = side1_transform.times(Mat4.scale(250, 1, 150));
        this.shapes.desert.draw(context, program_state, side1_transform, this.materials.desert_mat);


        //other cars
        this.update_spawn_cars(program_state);
        this.update_and_draw_other_cars(context, program_state);




        //boost(Crystal boost)
        if (program_state.animation_time - this.game_state.LAST_SPAWN_BOOST_TIME > this.game_state.BOOST_SPAWN_FREQUENCY) {
            this.game_state.LAST_SPAWN_BOOST_TIME = program_state.animation_time;
            const newBoost = {
                lane: Math.floor(Math.random() * 3) - 1, // Choose a new lane for the boost
                spawnTime: program_state.animation_time,
            };
            this.game_state.BOOSTS.push(newBoost); // Add the new boost to the array
        }
        for (const boost of this.game_state.BOOSTS) {
            let boost_transform = Mat4.identity();
            const boostSpeed = this.game_state.SPEED; // Assuming the speed is defined in the game state
            const boostInitialPosition = 0; // The initial position of the boost
            const boostOffset = (program_state.animation_time - boost.spawnTime) / 30 * boostSpeed;
            const boostY = boostInitialPosition - boostOffset;
            let boostX = boost.lane * 5; // Use the lane stored in the boost object
            const boostZ = 2;
        
            boost_transform = Mat4.identity().times(Mat4.translation(boostX, boostZ, boostY));
            boost_transform = boost_transform.times(Mat4.scale(this.constants.BOOST_SIZE,this.constants.BOOST_SIZE , this.constants.BOOST_SIZE));
            this.shapes.boost.draw(context, program_state, boost_transform, this.materials.boost_mat);
            let boostPos = boost_transform.times(vec4(0, 0, 0, 1)); // Multiply by a vector to get a vector
            let boostPosX = boostPos[0];//get dimensions for the bounding boxes
            let boostPosY = boostPos[1];
            let boostPosZ = boostPos[2];

            //boost collision detection
            for (const boost of this.game_state.BOOSTS) {
                // ...
            
                // Calculate the car's bounding box
                const carMinX = carPosX - 1.5; // Assuming the car's width is 3
                const carMaxX = carPosX + 1.5;
                const carMinY = carPosY - 2.5; // Assuming the car's height is 5
                const carMaxY = carPosY + 2.5;
                const carMinZ = carPosZ - 3; // Assuming the car's depth is 6
                const carMaxZ = carPosZ + 3;
            
                // Calculate the boost's bounding box
                const boostMinX = boostPosX - this.constants.BOOST_SIZE;
                const boostMaxX = boostPosX + this.constants.BOOST_SIZE;
                const boostMinY = boostPosY - this.constants.BOOST_SIZE;
                const boostMaxY = boostPosY + this.constants.BOOST_SIZE;
                const boostMinZ = boostPosZ - this.constants.BOOST_SIZE;
                const boostMaxZ = boostPosZ + this.constants.BOOST_SIZE;
            
                // Check if the bounding boxes intersect
                if (carMinX <= boostMaxX && carMaxX >= boostMinX &&
                    carMinY <= boostMaxY && carMaxY >= boostMinY &&
                    carMinZ <= boostMaxZ && carMaxZ >= boostMinZ) {
                    // A collision has occurred
                    //console.log('Collision detected!');
                    this.game_state.SPEED *= this.game_state.BOOST_SPEED_MULTIPLIER;
                    this.game_state.OTHER_CAR_SPEED *= this.game_state.BOOST_SPEED_MULTIPLIER;

                    setTimeout(() => {
                        this.game_state.SPEED = 1;//reset speed
                        this.game_state.OTHER_CAR_SPEED = 0.5;
                    }, this.game_state.BOOST_DURATION);
                }
            }
        }
        
    }

    draw_road_stripes(context, program_state)
    {
        let i = 0;
        const stripePlusGapLength = this.constants.STRIPE_LENGTH * 3;
        while (true) {
            const initialStripePosition = stripePlusGapLength * i + this.constants.ROAD_MIN_DISTANCE;
            const stripeOffset = (program_state.animation_time / 30) * this.game_state.SPEED;
            const stripePosition = initialStripePosition - (stripeOffset % stripePlusGapLength);

            i += 1;

            if (stripePosition > this.constants.ROAD_MAX_DISTANCE) {
                break;
            }

            let stripe_right_transform = Mat4.identity();
            stripe_right_transform = Mat4.identity().times(Mat4.translation(-3, 0.01, stripePosition));
            stripe_right_transform = stripe_right_transform.times(Mat4.scale(this.constants.STRIPE_WIDTH, 1, this.constants.STRIPE_LENGTH));
            this.shapes.road_stripe.draw(context, program_state, stripe_right_transform, this.materials.road_stripe_mat);

            let stripe_left_transform = Mat4.identity();
            stripe_left_transform = Mat4.identity().times(Mat4.translation(3, 0.01, stripePosition));
            stripe_left_transform = stripe_left_transform.times(Mat4.scale(this.constants.STRIPE_WIDTH, 1, this.constants.STRIPE_LENGTH));
            this.shapes.road_stripe.draw(context, program_state, stripe_left_transform, this.materials.road_stripe_mat);
        }
    }

    update_spawn_cars(program_state) {
        const currentTime = program_state.animation_time;
        if (currentTime >= this.game_state.LAST_SPAWN_CAR_TIME + this.game_state.NEXT_SPAWN_TIME) {
            this.game_state.LAST_SPAWN_CAR_TIME = currentTime;
            this.game_state.NEXT_SPAWN_TIME = 1000 + Math.random() * 4000; // Next spawn between 1 and 5 seconds (random, can change)

            const numberOfCars = Math.floor(1 + Math.random() * 2); // 1 to 2 cars (don't want to block all three lanes)
            let lanes = [-1, 0, 1];
            for (let i = 0; i < numberOfCars; i++) {
                let laneIndex = Math.floor(Math.random() * lanes.length);
                let lane = lanes.splice(laneIndex, 1)[0];
                const newCar = {
                    lane: lane,
                    positionZ: this.constants.ROAD_MAX_DISTANCE,
                };
                this.game_state.OTHER_CARS.push(newCar);
            }
        }
    }

    update_and_draw_other_cars(context, program_state) {
        let cars_to_keep = [];
        for (const car of this.game_state.OTHER_CARS) {
            car.positionZ -= this.game_state.OTHER_CAR_SPEED * this.game_state.SPEED;
            if (car.positionZ > this.constants.ROAD_MIN_DISTANCE) {
                let car_transform = Mat4.translation(car.lane * 6, 0.5, car.positionZ).times(Mat4.scale(2, 2, 4));
                this.shapes.car.draw(context, program_state, car_transform, this.materials.car_mat);
                cars_to_keep.push(car);
            }
        }
        this.game_state.OTHER_CARS = cars_to_keep;
    }
}



class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template
    // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return (
            ` 
        precision mediump float;
        const int N_LIGHTS = ` +
            this.num_lights +
            `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        varying vec4 vertex_color; //vec4 is neccesary for some reason?? fix ur discussion slides they say use vec3
        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" boostod:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `
        );
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return (
            this.shared_glsl_code() +
            `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
            //uniform vec4 shape_color;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;

                // Compute an initial (ambient) color:
                vertex_color = vec4( shape_color.xyz * ambient, shape_color.w );
                // Compute the final color with contributions from lights:
                vertex_color.xyz += phong_model_lights( N , vertex_worldspace );
            } `
        );
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return (
            this.shared_glsl_code() +
            `
            void main(){                                                           
                gl_FragColor = vertex_color;
                //return;
            } `
        );
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1),
            camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform
            .reduce((acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r));
            }, vec4(0, 0, 0, 0))
            .to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length) return;

        const light_positions_flattened = [],
            light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(
            gpu.light_attenuation_factors,
            gpu_state.lights.map((l) => l.attenuation)
        );
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = { color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40 };
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
        return (
            this.shared_glsl_code() +
            `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
            center = model_transform *vec4(0.0, 0.0,0.0 ,1.0);
            point_position = model_transform * vec4(position, 1.0);
            gl_Position = projection_camera_model_transform * vec4(position, 1.0);
        }`
        );
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        return (
            this.shared_glsl_code() +
            `
        void main(){
            float scalar = sin(18.09 * distance(point_position.xyz, center.xyz));
            gl_FragColor = scalar * vec4(0.6901, 0.502, 0.251, 1.0);
        }`
        );
    }
}
