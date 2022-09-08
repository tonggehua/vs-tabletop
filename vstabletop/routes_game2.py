from vstabletop.workers.game2_worker import make_empty_graphs, game2_worker_fetch, \
                                            game2_worker_convert, make_graph,\
                                            convert_2d_drawing, convert_1d_drawing,\
                                            retrieve_erase_mask

from flask import flash, render_template, session, redirect, url_for, request
from urllib.request import urlopen
from werkzeug.utils import secure_filename
from forms import Game2Form
import vstabletop.utils as utils
from vstabletop.paths import IMG_PATH
import numpy as np
import json
import plotly
import os
import fnmatch

from __main__ import app, login_manager, db, socketio, ALLOWED_EXTENSIONS

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Games
@app.route('/games/2',methods=["GET","POST"])
def game2():
    G2Form = Game2Form()
    j1, j2 = make_empty_graphs()

    # Load the user-uploaded image by default, if applicable

    # User uploaded image!
    if request.method == 'POST':
        #uploaded = request.form.get('uploaded')
        print('Uploaded data: ', request.files)

        if 'file' not in request.files:
            print('No file uploaded')
            file = ''
        else:
            file = request.files['file']
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file and allowed_file(file.filename):
            #filename = secure_filename(file.filename)
            ext = file.filename.split('.')[-1]
            file.save(os.path.join(app.config['UPLOAD_FOLDER_GAME2'], f'user_uploaded.{ext}'))
            utils.update_session_subdict(session,'game2',{'source':'upload'})

        if session['game2']['source'] == 'upload':
            generate_new_image('upload')

    return render_template('game2.html',template_title="K-space magik",template_intro_text="Can you find your way?",
                           template_game_form=G2Form, graphJSON_left=j1, graphJSON_right=j2,
                           game_num=2)

# Socket
@socketio.on('Request signal')
def generate_new_signal(payload):
    if session['game2']['source'] == 'preset':
        print(f"Signal [{payload['name']}] requested")
        graphJSON, data, scale = game2_worker_fetch('original',1,name=payload['name'])
        # Save state to session
    elif session['game2']['source'] == 'drawing':
        graphJSON, data, scale = convert_1d_drawing(IMG_PATH / 'Game2' / 'drawing.png', 'signal')

    utils.update_session_subdict(session,'game2',{'data_left': data, 'scale_left': scale})
    socketio.emit('Deliver signal',{'graph': graphJSON})


# Socket
@socketio.on('Request image')
def generate_new_image(payload):
    # Retrieve info
    myinfo = {'image_angle': session['game2']['image_angle']}

    if session['game2']['source'] == 'preset':
        print(f"Image [{payload['name']}] requested")
        if payload['name'] in ['sin','cos','circ']:
            myinfo['wave_k'] = session['game2']['wave_k']
            myinfo['wave_phase'] = session['game2']['wave_phase']
        graphJSON, data, scale = game2_worker_fetch('original',2,name=payload['name'],info=myinfo)
    elif session['game2']['source'] == 'drawing':
        graphJSON, data, scale = convert_2d_drawing(IMG_PATH / 'Game2' / 'drawing.png', 'image')
    elif session['game2']['source'] == 'upload' or payload=='upload':
        print('Upload detected...')
        for f in os.listdir(IMG_PATH / 'Game2'):
            if fnmatch.fnmatch(f,'user_uploaded.*'):
                uploaded_file_path = IMG_PATH / 'Game2' / f
                break
        print('Let us convert')
        graphJSON, data, scale = convert_2d_drawing(uploaded_file_path,'image')

    utils.update_session_subdict(session,'game2',{'data_left': data, 'scale_left': scale})
    socketio.emit('Deliver image',{'graph': graphJSON})


# Socket
@socketio.on('Request spectrum')
def generate_new_spectrum(payload):
    if session['game2']['source'] == 'preset':
        print(f"Spectrum [{payload['name']}] requested")
        graphJSON, data, scale = game2_worker_fetch('frequency',1,name=payload['name'])
    elif session['game2']['source'] == 'drawing':
        graphJSON, data, scale = convert_1d_drawing(IMG_PATH / 'Game2' / 'drawing.png', 'signal')

    utils.update_session_subdict(session,'game2',{'data_right': data, 'scale_right': scale})
    socketio.emit('Deliver spectrum',{'graph': graphJSON})


# Socket
@socketio.on('Request kspace')
def generate_new_kspace(payload):
    if session['game2']['source'] == 'preset':
        print(f"Kspace [{payload['name']}] requested")
        graphJSON, data, scale = game2_worker_fetch('frequency',2,name=payload['name'])
    elif session['game2']['source'] == 'drawing':
        graphJSON, data, scale = convert_2d_drawing(IMG_PATH / 'Game2' / 'drawing.png', 'kspace')

    utils.update_session_subdict(session,'game2',{'data_right': data, 'scale_right': scale})
    socketio.emit('Deliver kspace',{'graph':  graphJSON})

@socketio.on('Perform forward transform')
def forward_transform():
    # Use current session info
    input = session['game2']['data_left']
    scale = session['game2']['scale_left']
    graphJSON, data, scale = game2_worker_convert(input, scale, forward=True)
    utils.update_session_subdict(session,'game2',{'data_right': data, 'scale_right': scale})
    if len(input.shape) == 2:
        socketio.emit('Deliver kspace',{'graph': graphJSON})
    elif len(input.shape) == 1:
        socketio.emit('Deliver spectrum',{'graph':graphJSON})



@socketio.on('Perform backward transform')
def backward_transform():
    # Use current session info
    input = session['game2']['data_right']
    scale = session['game2']['scale_right']

    graphJSON, data, scale = game2_worker_convert(input, scale, forward=False)

    # Update session too.
    utils.update_session_subdict(session,'game2',{'data_left': data, 'scale_left': scale})
    if len(input.shape) == 2:
        socketio.emit('Deliver image',{'graph': graphJSON})
    elif len(input.shape) == 1:
        socketio.emit('Deliver signal',{'graph':graphJSON})

@socketio.on('Send drawing')
def process_drawing(payload):
    # Write drawing to png file
    img_url = payload['url']
    with urlopen(img_url) as response:
        data = response.read()
    with open(IMG_PATH / 'Game2' / 'drawing.png', 'wb') as f:
        f.write(data)

    utils.update_session_subdict(session,'game2',{'source': 'drawing'})
    socketio.emit('message', {'text':'Drawing saved!','type':'success'})

@socketio.on('Send erase')
def process_erasing_mask(payload):
    # Write erase mask to png file
    img_url = payload['url']
    with urlopen(img_url) as response:
        data = response.read()
    with open(IMG_PATH / 'Game2' / 'erase.png', 'wb') as f:
        f.write(data)

    mask = retrieve_erase_mask(shape=session['game2']['data_right'].shape)
    utils.update_session_subdict(session,'game2',{'erase_mask': mask})
    update_chart_right()

@socketio.on('Reset erase')
def cancel_erase():
    mask = np.ones(session['game2']['data_right'].shape)
    utils.update_session_subdict(session,'game2',{'erase_mask': mask})
    update_chart_right()



# TODO : erasing part of k-space!
def update_chart_right():
    input = session['game2']['data_right']
    scale = session['game2']['scale_right']

    if len(input.shape) == 2:
        try:
            input = input * session['game2']['erase_mask']
        except:
            raise TypeError('Erase mask is not in session')

        fig = make_graph(input,scale,type='kspace')
        graphJSON = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        socketio.emit('Deliver kspace',{'graph': graphJSON})

    utils.update_session_subdict(session,'game2',{'data_right': input})


@socketio.on('Go back to preset')
def revert_to_preset():
    utils.update_session_subdict(session,'game2',{'source':'preset'})

@socketio.on('Use slicer info')
def apply_slicer(payload):
    Nx, Ny = session['game2']['data_right'].shape
    mask = np.zeros((Nx,Ny))
    # Apply k-space restriction
    nx1 = int(payload['x1']*Nx)
    nx2 = int(payload['x2']*Nx)
    ny1 = int(Ny * payload['y1'])
    ny2 = int(Ny * payload['y2'])
    print(nx1,nx2,ny1,ny2)
    mask[nx1:nx2, ny1:ny2] = 1
    if payload['inverted']:
        mask = 1 - mask
    mask = np.flipud(mask)
    # Apply subsampling
    usfx = int(payload['usf-x'])
    usfy = int(payload['usf-y'])
    usmask = np.zeros((Nx, Ny))
    print(usfx,usfy)
    usmask[0::usfx, 0::usfy] = 1

    # Combine the two effects
    mask *= usmask

    utils.update_session_subdict(session,'game2',{'erase_mask': mask})
    update_chart_right()




