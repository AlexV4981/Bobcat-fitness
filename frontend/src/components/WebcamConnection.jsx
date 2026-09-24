import { useRef } from "react";
import { useState } from "react";


//videoRef allows the webcam to stream to video element

function WebcamConnection() {
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const [errorMessage, setErrorMessage] = useState('')
    const [isWebcamOn, setIsWebcamOn] = useState(false)


//asks for permission to use webcam
async function startWebcam() {
    try {
        setErrorMessage('')

        //the line below makes the browser ask for permission
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
        })

        streamRef.current = stream
        videoRef.current.srcObject = stream
        setIsWebcamOn(true)

    } catch (error) {
        setErrorMessage('Camera permission was denied or is unavailble')
        console.error(error)
    }
    
}

function stopWebcam() {
    //grabbing the current stream to check if there anything there
    if (streamRef.current){
        //finds the footage from the camera then turns turns it off
        streamRef.current.getTracks().forEach((track) => {
            //track.stop makes us release the camera so its not using it anymore
            track.stop()
        })
        //ensures the camera is no longer being watched
        streamRef.current = null
    }

    //sets the videoRef tp null to ensure the program isnt holding previous footage
    if (videoRef.current) {
        videoRef.current.srcObject = null
    }

    //rests the truth process
    setIsWebcamOn(false)
}

//returns all the information

return (
    <section>
        <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Live webcam preview"></video>


        <button type ="button" onClick={isWebcamOn ? stopWebcam : startWebcam}>
            {isWebcamOn ? 'Close' : 'Start'}
        </button>

        {errorMessage && <p role="alert">{errorMessage}</p>}



    </section>
)}


export default WebcamConnection