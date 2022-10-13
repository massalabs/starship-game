use macroquad::{
    prelude::{Vec2, BLACK},
    shapes::draw_rectangle,
};

pub fn draw_box(
    pos: Vec2,
    size: Vec2,
) {
    let dimension = size * 2.;
    let upper_left = pos - size;

    draw_rectangle(upper_left.x, upper_left.y, dimension.x, dimension.y, BLACK);
}

pub fn vec2_from_angle(angle: f32) -> Vec2 {
    let angle = angle - std::f32::consts::FRAC_PI_2;
    Vec2::new(angle.cos(), angle.sin())
}
