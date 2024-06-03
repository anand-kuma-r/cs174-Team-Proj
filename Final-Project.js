import { defs, tiny } from "./examples/common.js";
import { Shape_From_File } from "./examples/obj-file-demo.js";

const { Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene } = tiny;

export class Final_Project extends Scene {
    constructor() {
        super();
        this.initialize_shapes();
        this.initialize_materials();
        this.initialize_constants();
        this.initialize_game_state();
        this.initial_camera_location = Mat4.look_at(vec3(0, 5, this.constants.ROAD_MIN_DISTANCE), vec3(0, 10, 50), vec3(0, 1, 0));
        this.person_camera_location = Mat4.look_at(vec3(0, 2.5, -76), vec3(0, 2.5, -75), vec3(0, 1, 0));
        this.perspective_person = false;
    }

    initialize_shapes() {
        this.shapes = {
            road: new defs.Cube(),
            road_stripe: new defs.Cube(),
            desert: new defs.Cube(),
            taxi: new Shape_From_File("assets/taxi.obj"),//Taxi blender model (the controllable character)
            car: new Shape_From_File("assets/car.obj"),//Car blender model (obstacle)
            truck: new Shape_From_File("assets/truck.obj"), // Truck blender model (obstacle)
            boost: new defs.Cube(),
            heart: new Shape_From_File("assets/heart.obj"), // Heart blender model
        };
    }

    initialize_materials() {
        this.materials = {
            road_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#303030"), specularity: 0 }),
            road_stripe_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#FFFFFF"), specularity: 0 }),
            desert_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#E3CDA4"), specularity: 0 }),
            taxi_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#ffff00"), specularity: 0 }),
            car_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#8b0000"), specularity: 0 }),
            truck_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#808080"), specularity: 0 }),
            boost_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#0096FF"), specularity: 0 }),
            heart_mat: new Material(new defs.Phong_Shader(), { ambient: 0.8, diffusivity: 0.5, color: hex_color("#8b0000"), specularity: 0 }),
        };
    }

    initialize_constants() {
        this.constants = {
            ROAD_MAX_DISTANCE: 150,
            ROAD_MIN_DISTANCE: -90,
            ROAD_WIDTH: 18,
            STRIPE_WIDTH: 0.2,
            STRIPE_LENGTH: 3,
            BOOST_SIZE: 0.2,
        };
    }

    initialize_game_state() {
        this.game_state = {
            SPEED: 1,
            CAR_LANE: 0,
            BOOST_LANE: Math.floor(Math.random() * 3) - 1,
            LAST_SPAWN_BOOST_TIME: 0,
            BOOST_SPAWN_FREQUENCY: 10 * 1000,
            BOOSTS: [],
            BOOST_DURATION: 1 * 1000,
            BOOST_SPEED_MULTIPLIER: 2,
            OTHER_CARS: [],
            OTHER_CAR_SPAWN_FREQUENCY: 6000,
            LAST_SPAWN_CAR_TIME: 0,
            NEXT_SPAWN_TIME: 2000,
            OTHER_CAR_SPEED: 0.5,
            LIVES_LEFT: 3,
            collisionInProgress: false,
        };
    }

    make_control_panel() {
        this.key_triggered_button("Go right", ["ArrowRight"], () => {
            this.game_state.CAR_LANE = Math.min(this.game_state.CAR_LANE + 1, 1);
        });
        this.key_triggered_button("Go left", ["ArrowLeft"], () => {
            this.game_state.CAR_LANE = Math.max(this.game_state.CAR_LANE - 1, -1);
        });
        this.key_triggered_button("Switch Perspective", ["p"], () => {
            this.perspective_person ^=1;
        })
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push((context.scratchpad.controls = new defs.Movement_Controls()));
        }

        let car_transform = Mat4.translation(-6 * this.game_state.CAR_LANE, 2.2, -75);
        let car_position = car_transform.times(vec4(0, 0, 0, 1));
        
        if (this.perspective_person == 1) {
            // Camera slightly ahead of car
            const camera_offset = vec4(0, 1.5, 1.42, 0); // Can change z value if we don't like the slight outline of car right now
            let camera_position = car_position.plus(camera_offset);

            // Camera looks slightly ahead of car
            let target_position = car_position.plus(vec4(0, 2, 10, 0));
            //console.log(target_position);

            this.person_camera_location = Mat4.look_at(camera_position.to3(), target_position.to3(), vec3(0, 1, 0));
            program_state.set_camera(this.person_camera_location);
        }
        else
        {
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.1, 1000);
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        //Draw the Road and stripes
        this.draw_road(context, program_state);
        this.draw_road_stripes(context, program_state);

        //Draw the taxi and surroundings
        this.draw_car(context, program_state);
        this.draw_desert(context, program_state);
        //Add obstacles to road
        //Draw other cars and trucks, and check for collision
        this.spawn_cars(program_state);
        this.update_and_draw_cars(context, program_state);
        this.check_car_collisions(program_state);

        //Add power ups to road
        //Draw speed boosts
        this.update_and_draw_boosts(context, program_state);
        //console.log(this.game_state.LIVES_LEFT);

        //Draw Lives in top Right
        this.draw_hearts(context, program_state);
    }

    draw_road(context, program_state) {
        let road_transform = Mat4.identity().times(Mat4.scale(this.constants.ROAD_WIDTH / 2, 1, this.constants.ROAD_MAX_DISTANCE));
        this.shapes.road.draw(context, program_state, road_transform, this.materials.road_mat);
    }

    draw_road_stripes(context, program_state) {
        let i = 0;
        const stripePlusGapLength = this.constants.STRIPE_LENGTH * 3;
        while (true) {
            const initialStripePosition = stripePlusGapLength * i + this.constants.ROAD_MIN_DISTANCE;
            const stripeOffset = (program_state.animation_time / 30) * this.game_state.SPEED;
            const stripePosition = initialStripePosition - (stripeOffset % stripePlusGapLength);

            i += 1;
            if (stripePosition > this.constants.ROAD_MAX_DISTANCE) break;

            let stripe_right_transform = Mat4.translation(-3, 0.01, stripePosition).times(Mat4.scale(this.constants.STRIPE_WIDTH, 1, this.constants.STRIPE_LENGTH));
            this.shapes.road_stripe.draw(context, program_state, stripe_right_transform, this.materials.road_stripe_mat);

            let stripe_left_transform = Mat4.translation(3, 0.01, stripePosition).times(Mat4.scale(this.constants.STRIPE_WIDTH, 1, this.constants.STRIPE_LENGTH));
            this.shapes.road_stripe.draw(context, program_state, stripe_left_transform, this.materials.road_stripe_mat);
        }
    }

    draw_car(context, program_state) {
        let car_transform = Mat4.translation(-6 * this.game_state.CAR_LANE, 2.2, -75).times(Mat4.scale(2, 2.5, 3));
        this.shapes.taxi.draw(context, program_state, car_transform, this.materials.taxi_mat);
        this.carPos = car_transform.times(vec4(0, 0, 0, 1));
    }

    draw_desert(context, program_state) {
        let side1_transform = Mat4.translation(1, -0.01, 0).times(Mat4.scale(250, 1, 150));
        this.shapes.desert.draw(context, program_state, side1_transform, this.materials.desert_mat);
    }

    draw_hearts(context, program_state) {
        const heart_scale = 2;
        const heart_offset_x = 6;
        const heart_offset_y = 0.5;
        const initial_heart_position = vec3(-30, 30, -25); 

        for (let i = 0; i < this.game_state.LIVES_LEFT; i++) {
            let heart_transform = Mat4.identity()
                .times(Mat4.translation(initial_heart_position[0] + i * heart_offset_x, initial_heart_position[1] - heart_offset_y, initial_heart_position[2]))
                .times(Mat4.scale(heart_scale, heart_scale, heart_scale));
            this.shapes.heart.draw(context, program_state, heart_transform, this.materials.heart_mat);
        }
    }

    spawn_cars(program_state) {
        const currentTime = program_state.animation_time;
        if (currentTime >= this.game_state.LAST_SPAWN_CAR_TIME + this.game_state.NEXT_SPAWN_TIME) {
            this.game_state.LAST_SPAWN_CAR_TIME = currentTime;
            this.game_state.NEXT_SPAWN_TIME = 1000 + Math.random() * 4000;

            const numberOfCars = Math.floor(1 + Math.random() * 2); // random number of cars generated at this moment between 1-2
            let lanes = [-1, 0, 1]; // -1 -> left, 0 -> middle, 1 -> right
            for (let i = 0; i < numberOfCars; i++) {
                if (lanes.length === 0) break;
                let laneIndex = Math.floor(Math.random() * lanes.length); // Choose random lane for car to spawn in
                let lane = lanes.splice(laneIndex, 1)[0]; // Get the lane number 
                let vehicleType = Math.random() < 0.25 ? 'truck' : 'car'; // Choose obstacle to spawn in (truck or car)
                const newCar = {
                    type: vehicleType,
                    lane: lane,
                    positionZ: this.constants.ROAD_MAX_DISTANCE,
                };
                this.game_state.OTHER_CARS.push(newCar); // Add to array of cars on road
            }
        }
    }

    update_and_draw_cars(context, program_state) {
        let cars_to_keep = [];
        for (const car of this.game_state.OTHER_CARS) {
            car.positionZ -= this.game_state.OTHER_CAR_SPEED;
            if (car.positionZ > this.constants.ROAD_MIN_DISTANCE) {
                let car_transform = Mat4.translation(car.lane * 6, 1.5, car.positionZ);
                if (car.type == 'car') {
                    car_transform = car_transform.times(Mat4.scale(2, 2, 4));
                    this.shapes.car.draw(context, program_state, car_transform, this.materials.car_mat);
                } else if (car.type == 'truck') {
                    car_transform = car_transform.times(Mat4.scale(2, 3, 6));
                    this.shapes.truck.draw(context, program_state, car_transform, this.materials.truck_mat);
                }
                cars_to_keep.push(car);
            }
        }
        this.game_state.OTHER_CARS = cars_to_keep;
    }

    update_and_draw_boosts(context, program_state) {
        if (program_state.animation_time - this.game_state.LAST_SPAWN_BOOST_TIME > this.game_state.BOOST_SPAWN_FREQUENCY) {
            this.game_state.LAST_SPAWN_BOOST_TIME = program_state.animation_time;
            const newBoost = {
                lane: Math.floor(Math.random() * 3) - 1,
                spawnTime: program_state.animation_time,
            };
            this.game_state.BOOSTS.push(newBoost);
        }
        for (const boost of this.game_state.BOOSTS) {
            let boost_transform = Mat4.translation(boost.lane * 5, 2, this.constants.ROAD_MAX_DISTANCE - ((program_state.animation_time - boost.spawnTime) / 30 * this.game_state.SPEED));
            boost_transform = boost_transform.times(Mat4.scale(this.constants.BOOST_SIZE, this.constants.BOOST_SIZE, this.constants.BOOST_SIZE));
            this.shapes.boost.draw(context, program_state, boost_transform, this.materials.boost_mat);

            let boostPos = boost_transform.times(vec4(0, 0, 0, 1));
            this.check_boost_collision(boostPos);
        }
    }

    check_boost_collision(boostPos) {
        let boostPosX = boostPos[0];
        let boostPosY = boostPos[1];
        let boostPosZ = boostPos[2];

        const carMinX = this.carPos[0] - 1.5;
        const carMaxX = this.carPos[0] + 1.5;
        const carMinY = this.carPos[1] - 2.5;
        const carMaxY = this.carPos[1] + 2.5;
        const carMinZ = this.carPos[2] - 3;
        const carMaxZ = this.carPos[2] + 3;

        const boostMinX = boostPosX - this.constants.BOOST_SIZE;
        const boostMaxX = boostPosX + this.constants.BOOST_SIZE;
        const boostMinY = boostPosY - this.constants.BOOST_SIZE;
        const boostMaxY = boostPosY + this.constants.BOOST_SIZE;
        const boostMinZ = boostPosZ - this.constants.BOOST_SIZE;
        const boostMaxZ = boostPosZ + this.constants.BOOST_SIZE;

        if (carMinX <= boostMaxX && carMaxX >= boostMinX &&
            carMinY <= boostMaxY && carMaxY >= boostMinY &&
            carMinZ <= boostMaxZ && carMaxZ >= boostMinZ) {
            this.game_state.SPEED *= this.game_state.BOOST_SPEED_MULTIPLIER;
            this.game_state.OTHER_CAR_SPEED = this.game_state.BOOST_SPEED_MULTIPLIER;

            setTimeout(() => {
                this.game_state.SPEED = 1;
                this.game_state.OTHER_CAR_SPEED = 0.5;
            }, this.game_state.BOOST_DURATION);
        }
    }

    check_car_collisions(program_state) {
        const carMinX = this.carPos[0] - 1.5;
        const carMaxX = this.carPos[0] + 1.5;
        const carMinY = this.carPos[1] - 2.5;
        const carMaxY = this.carPos[1] + 2.5;
        const carMinZ = this.carPos[2] - 3;
        const carMaxZ = this.carPos[2] + 3;

        for (const otherCar of this.game_state.OTHER_CARS) {
            const otherCarTransform = Mat4.translation(otherCar.lane * 6, 1.5, otherCar.positionZ);
            const otherCarPos = otherCarTransform.times(vec4(0, 0, 0, 1));
            const otherCarPosX = otherCarPos[0];
            const otherCarPosY = otherCarPos[1];
            const otherCarPosZ = otherCarPos[2];

            let otherCarMinX, otherCarMaxX, otherCarMinY, otherCarMaxY, otherCarMinZ, otherCarMaxZ;

            if (otherCar.type == 'car') {
                otherCarMinX = otherCarPosX - 1.0;
                otherCarMaxX = otherCarPosX + 1.0;
                otherCarMinY = otherCarPosY - 1.0;
                otherCarMaxY = otherCarPosY + 1.0;
                otherCarMinZ = otherCarPosZ - 2.0;
                otherCarMaxZ = otherCarPosZ + 2.0;
            } else if (otherCar.type == 'truck') {
                otherCarMinX = otherCarPosX - 1.0;
                otherCarMaxX = otherCarPosX + 1.0;
                otherCarMinY = otherCarPosY - 3;
                otherCarMaxY = otherCarPosY + 3;
                otherCarMinZ = otherCarPosZ - 3.0;
                otherCarMaxZ = otherCarPosZ + 3.0;
            }


            //Slow down temporarily when hit another car and subtract life by 1
            if (carMinX <= otherCarMaxX && carMaxX >= otherCarMinX &&
                carMinY <= otherCarMaxY && carMaxY >= otherCarMinY &&
                carMinZ <= otherCarMaxZ && carMaxZ >= otherCarMinZ) {
                if(!this.game_state.collisionInProgress)
                {
                    this.game_state.collisionInProgress = true;
                    this.game_state.LIVES_LEFT -=1;
                    this.game_state.SPEED *= 0.2;
                    this.game_state.OTHER_CAR_SPEED *= 0.2;
                }
                setTimeout(() => {
                    this.game_state.SPEED = 1;
                    this.game_state.OTHER_CAR_SPEED = 0.5;
                    this.game_state.collisionInProgress  =false;
                }, 2000);
            }
        }
    }
}

class Gouraud_Shader extends Shader {
    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        return ` 
        precision mediump float;
        const int N_LIGHTS = ${this.num_lights};
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;
        varying vec3 N, vertex_worldspace;
        varying vec4 vertex_color;

        vec3 phong_model_lights(vec3 N, vec3 vertex_worldspace) {                                        
            vec3 E = normalize(camera_center - vertex_worldspace);
            vec3 result = vec3(0.0);
            for (int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length(surface_to_light_vector);
                vec3 L = normalize(surface_to_light_vector);
                vec3 H = normalize(L + E);
                float diffuse = max(dot(N, L), 0.0);
                float specular = pow(max(dot(N, H), 0.0), smoothness);
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light);
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        return this.shared_glsl_code() + `
        attribute vec3 position, normal;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {                                                                   
            gl_Position = projection_camera_model_transform * vec4(position, 1.0);
            N = normalize(mat3(model_transform) * normal / squared_scale);
            vertex_worldspace = (model_transform * vec4(position, 1.0)).xyz;
            vertex_color = vec4(shape_color.xyz * ambient, shape_color.w);
            vertex_color.xyz += phong_model_lights(N, vertex_worldspace);
        } `;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
        void main() {                                                           
            gl_FragColor = vertex_color;
        } `;
    }

    send_material(gl, gpu, material) {
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        const O = vec4(0, 0, 0, 1),
              camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        const squared_scale = model_transform
            .reduce((acc, r) => acc.plus(vec4(...r).times_pairwise(r)), vec4(0, 0, 0, 0))
            .to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
        if (!gpu_state.lights.length) return;
        const light_positions_flattened = [],
              light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        const defaults = { color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40 };
        material = Object.assign({}, defaults, material);
        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
              PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main() {
            center = model_transform * vec4(0.0, 0.0, 0.0, 1.0);
            point_position = model_transform * vec4(position, 1.0);
            gl_Position = projection_camera_model_transform * vec4(position, 1.0);
        }`;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
        void main() {
            float scalar = sin(18.09 * distance(point_position.xyz, center.xyz));
            gl_FragColor = scalar * vec4(0.6901, 0.502, 0.251, 1.0);
        }`;
    }
}
