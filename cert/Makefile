generate_cert:
	openssl req -newkey rsa:2048 -nodes -keyout certificate.key \
        -x509 -out certificate.pem -subj '/CN=Test Certificate' \
        -addext "subjectAltName = DNS:localhost"

compute_hash:
	openssl x509 -pubkey -noout -in certificate.pem | \
        openssl rsa -pubin -outform der | \
        openssl dgst -sha256 -binary | base64
