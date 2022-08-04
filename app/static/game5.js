// Game 5 Javascript functions

// Initialize socket
let socket = io();

// Animation controls
let reqAnim, reqAnim2;

// Send message and data to backend when any input field value is changed
$(':input').on('change', (event)=>{
    socket.emit("Update param for Game5", {'id': event.target.id, 'value': event.target.value,
                                           'checked':event.target.checked});
})

$('#flip_angle').on('input',(event)=>{
    $('#fa_deg').html(`${event.target.value} degrees`)
})


$('#rf_phase').on('input',(event)=>{
    $('#rf_deg').html(`${event.target.value} degrees`)
})


// Shortcut settings for initial magnetization
// Change spherical coordinates to make M0 point towards x
$('#mag-x').on('click',()=>{
    // theta = 90, phi = 0, |M| = 1
    $('#m_theta').val(90);
    $('#m_phi').val(0);
    $('#m_size').val(1.0);
    socket.emit("Update params for Game5",{'m_theta':90,'m_phi':0,'m_size':1})
})

// Change spherical coordinates to make M0 point towards y
$('#mag-y').on('click',()=>{
    // theta = 90, phi = 0, |M| = 1
    $('#m_theta').val(90);
    $('#m_phi').val(90);
    $('#m_size').val(1.0);
    socket.emit("Update params for Game5",{'m_theta':90,'m_phi':90,'m_size':1})

})

// Change spherical coordinates to make M0 point towards z
$('#mag-z').on('click',()=>{
    // theta = 90, phi = 0, |M| = 1
    $('#m_theta').val(0);
    $('#m_phi').val(0);
    $('#m_size').val(1.0);
    socket.emit("Update params for Game5",{'m_theta':0,'m_phi':0,'m_size':1})

})

// Change spherical coordinates to set M0 to zero
$('#mag-0').on('click',()=>{
    $('#m_theta').val(0);
    $('#m_phi').val(0);
    $('#m_size').val(0);
    socket.emit("Update params for Game5",{'m_theta':0,'m_phi':0,'m_size':0})

})

// Rotational frame
$('#rot-frame-button').on('click',(event)=>{
    socket.emit('rot frame toggled',{'rot_frame_on': event.target.checked, 'b0_on':$('#b0_on').is(':checked')})
})

// Signal to backend to reset magnetization in 3D plot
$('#set-mag').on('click',()=>{
    socket.emit('set initial magnetization');
})

// Button functions
$('#b0_on').on('click',(event)=>{
    socket.emit('b0 toggled',{'b0_on': event.target.checked})
})


$('#start').on('click',()=>{
    socket.emit('simulate precession',{'b0_on': $('#b0_on').is(':checked'),
                                      'coil_on':$('#rx-button').is(':checked')})
})

$('#tip').on('click',()=>{
    socket.emit('simulate nutation',
                {'b0_on':$('#b0_on').is(':checked'), 'rot_frame_on':$('#rot-frame-button').is(':checked')});
})

$('#reset').on('click',()=>{
    socket.emit('reset everything');
    $('#b0_on').prop('checked',false);
    $('#rx-button').prop('checked',false);
    $('#tx-button').prop('checked',false);
    $('#rot-frame-button').prop('checked',false);

})

$('#stop').on('click',()=>{
    stop_animation_spin();
    stop_animation_signal();
})

$('#tx-button').on('click',(event)=>{
    socket.emit('tx toggled',{'tx_on': event.target.checked})
})



$('#rx-button').on('click',(event)=>{
    let rx_direction;

    if ($('#rx_dir_field-0').is(':checked')){
        rx_direction = 'x';
    }else{
        rx_direction = 'y';
    }

    socket.emit('rx toggled',{'rx_on': event.target.checked,'rx_dir': rx_direction});
})



// Update animation (general)
socket.on('update spin animation', (msg)=>{
    // Stop current animation
    stop_animation_spin();
    // Play new animation
    graphData = JSON.parse(msg['graph']);
    play_animation_spin(graphData, msg['loop_on']);

})

socket.on('update signal animation', (msg)=>{
    stop_animation_signal();
    graphData = JSON.parse(msg['graph']);
    play_animation_signal(graphData, msg['loop_on'])

})



socket.on('message', (msg)=>{
    let added_class;
    if (msg['type']==='warning'){
        added_class = 'text-danger';
    }
    else if (msg['type']==='success'){
        added_class = 'text-success';
    }
    else{
        added_class = 'text-primary';
    }
    $('#message-game5').text(msg['text']).removeClass('text-success text-danger text-primary').addClass(added_class);
    $('#megaphone').removeClass('text-success text-danger text-primary').addClass(added_class)
})



// Spin animation
function play_animation_spin(graphData, loop){
    console.log(graphData)
    let mx, my, mz;
    let time_ind = 0;
    let data_length = graphData.data[0].x.length;
    let layout = {
        autosize: true
    }
    Plotly.newPlot('chart-spin', {
        // Data
        data: [{
                type: 'scatter3d',
                x: [0, graphData.data[0].x[0]],
                y: [0, graphData.data[0].y[0]],
                z: [0, graphData.data[0].z[0]],
                mode: 'lines',
                line: graphData.data[0].line
        },
            {
                type: 'scatter3d',
                x: [graphData.data[0].x[0]],
                y: [graphData.data[0].y[0]],
                z: [graphData.data[0].z[0]],
                mode: 'lines',
                line: {   color:'darkorange',
                          width: 8,
                          dash: 'dot'
                }
            },

            graphData.data[1], graphData.data[2], graphData.data[3], graphData.data[4], graphData.data[5]
            ],
        layout: graphData.layout
    }, layout);


    // Retrieve next frame
    function compute(ind){
        mx = graphData.data[0].x[ind];
        my = graphData.data[0].y[ind];
        mz = graphData.data[0].z[ind];

        mx_hist = graphData.data[0].x.slice(0,ind);
        my_hist = graphData.data[0].y.slice(0,ind);
        mz_hist = graphData.data[0].z.slice(0,ind);


    }

    // Animate plot with all succeeding points
    function update(){
            compute(time_ind);
            Plotly.animate('chart-spin', {
                // A. Plot
                // B. Data
            data: [{
                type: 'scatter3d',
                    x: [0,mx],
                    y: [0,my],
                    z: [0,mz],
                    mode: 'lines',
                    line: graphData.data[0].line},
                  {
                type: 'scatter3d',
                    x: mx_hist,
                      y: my_hist,
                      z: mz_hist,
                      mode: 'lines',
                      line: {
                        color:'darkorange',
                          width: 8,
                          dash: 'dot'
                        }}

            ],


                // Layout
            layout: graphData.layout},
                // B. Animation options
           {
            transition: {
              duration: 0
            },
            frame: {
              duration: 10,
              redraw: true
            }
          },layout);

        // When stop signal variable is set to True, stop it


        // Stop increasing it once it hits the end
        if (time_ind < data_length - 1){
            time_ind ++;
            reqAnim = requestAnimationFrame(update);
        }
        else if (loop){
            time_ind = 0;
            reqAnim = requestAnimationFrame(update);
        }


        }
        reqAnim = requestAnimationFrame(update);
}

function stop_animation_spin(){
  cancelAnimationFrame(reqAnim)
}

function play_animation_signal(graphData,loop){
    // TODO make this proper animation
    //Plotly.newPlot('chart-signal', graphData, layout);
    //console.log(graphData);


    let time_ind = 0;
    let data_length = graphData.data[0].x.length;
    let layout = {
        autosize: true
    }
    Plotly.newPlot('chart-signal', {
        // Data
        data: [{
                type: 'scatter',
                x: [graphData.data[0].x[0]],
                y: [graphData.data[0].y[0]],
                mode: 'lines',
                line: graphData.data[0].line
        },
            ],
        layout: graphData.layout
    }, layout);
    // TODO: fix axis range


    // Retrieve next frame
    function compute(ind){
        times = graphData.data[0].x.slice(0,ind);
        signals = graphData.data[0].y.slice(0,ind);

    }

    // Animate plot with all succeeding points
    // At each time point, plot curve up to that point and add on progress line.
    function update(){
            compute(time_ind);
            Plotly.animate('chart-signal', {
                // A. Plot
                // B. Data
            data: [{
                type: 'scatter',
                    x: times,
                    y: signals,
                    mode: 'lines',
                    line: graphData.data[0].line},

            ],
                // Layout
            layout: graphData.layout},
                // B. Animation options
           {
            transition: {
              duration: 0
            },
            frame: {
              duration: 10,
              redraw: true
            }
          },layout);



        // Stop increasing it once it hits the end
        if (time_ind < data_length - 1){
            time_ind ++;
            reqAnim2 = requestAnimationFrame(update);
        }
        else if (loop){
            time_ind = 0;
            reqAnim2 = requestAnimationFrame(update);
        }
        }
        reqAnim2 = requestAnimationFrame(update);
}

function stop_animation_signal(){
    cancelAnimationFrame(reqAnim2)
}

// Enable question mark popovers
$(document).ready(function(){
  $('[data-bs-toggle="popover"]').popover();
});

// Multiple choice
$('.answer-mc').on('click', (event)=>{
    submit_id = event.target.id;
    q_ind = submit_id[submit_id.length-1]
    console.log(submit_id);
    choice = $(`.q${q_ind}-choice:checked`).attr("value");

    console.log(choice)

    let letters = ['a','b','c','d'];

    if (choice == letters[parseInt($(`#mc-correct-choice-${q_ind}`).text())]){
        console.log("Answer is correct! ")
        // Make success text visible
        $(`#mc-success-text-${q_ind}`).removeClass('d-none')
        $(`#mc-failure-text-${q_ind}`).addClass('d-none')
        socket.emit('game 5 question answered',{'ind':q_ind, 'correct':true});

    }
    else{
        console.log("Answer is wrong! ")
        $(`#mc-success-text-${q_ind}`).addClass('d-none')
        $(`#mc-failure-text-${q_ind}`).removeClass('d-none')
        socket.emit('game 5 question answered',{'ind':q_ind,'correct':false});

        // Hide success text
    }
    console.log('Updating choice')
})


socket.on('renew stars',(msg)=>{
    console.log('Stars should be updated now...')
    num_stars = msg['stars'];
    num_full = parseInt(Math.floor(num_stars));
    num_half = parseInt(Math.round((num_stars-num_full)*2));
    num_empty = 5 - num_full - num_half;


    let stars_html = `<span> ${num_stars} / 5 stars earned</span> `
    stars_html += '<i class="bi bi-star-fill"></i> '.repeat(num_full)
    stars_html += '<i class="bi bi-star-half"></i> '.repeat(num_half)
    stars_html += '<i class="bi bi-star"></i> '.repeat(num_empty)

    $("#stars-display").html(stars_html);



})