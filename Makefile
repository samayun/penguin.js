# build:
# 	sudo docker build . -t samayun/penguin

# start:
# 	sudo  docker run -p 8080:8080 -d samayun/penguin

# run:
# 	sudo  docker run -p 8080:8080 samayun/penguin

# kill:
# 	sudo killall node

######################
###  DEVELOPMENT   ###
######################

build:
	sudo docker-compose up --build --detach

destroy:
	sudo docker-compose down --volumes

lint:
	sudo docker-compose exec api npm lint

start:
	sudo docker-compose up --detach

stop:
	sudo docker-compose stop

shell:
	sudo docker-compose exec api bash
	
logs:
	sudo docker-compose logs --follow api
