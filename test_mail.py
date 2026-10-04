from flask import Flask
from flask_mail import Mail, Message

app = Flask(__name__)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'birriasabrosa0@gmail.com'
app.config['MAIL_PASSWORD'] = 'pmnlvhoxfejfspgs'

mail = Mail(app)

with app.app_context():
    try:
        msg = Message(
            subject="Prueba directa Flask",
            sender=app.config['MAIL_USERNAME'],
            recipients=['tu-correo@gmail.com']
        )
        msg.body = "Este es un correo de prueba directa."
        mail.send(msg)
        print("¡CORREO ENVIADO CON ÉXITO!")
    except Exception as e:
        print(f"❌ ERROR DETALLADO: {str(e)}")