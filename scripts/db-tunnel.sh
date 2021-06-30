#!/bin/bash
set -eu

GREEN_ON='[0;32m'
RED_ON='[0;31m'
COLOR_OFF='[0m'

if [[ $# -lt 2 ]] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} Usage: yarn db-tunnel stack-name ./path/to/private/key\n\n"
  exit 1
fi

# Set vars
stack="$1"
ssh_key="$2"
db_identifier=$(echo $stack | tr "[:upper:]" "[:lower:]")db


if [[ ! -f "$ssh_key" ]] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} SSH Key not found. Usage: yarn db-tunnel stack-name ./path/to/private/key\n\n"
  exit 1
fi

if [[ ! -f "$ssh_key.pub" ]] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} SSH Public Key not found. Usage: yarn db-tunnel stack-name ./path/to/private/key\n\n"
  exit 1
fi

echo "${GREEN_ON}√${COLOR_OFF} Retrieving RDS DB Endpoint"
export RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $db_identifier \
  --query "DBInstances[0].Endpoint.Address" | tr -d '"')
if [ $RDS_ENDPOINT == "null" ] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} Unable to determine the RDS Endpoint"
  exit 1
fi

echo "${GREEN_ON}√${COLOR_OFF} Retrieving the Bastion Host Instance IP Address"
export BASTION_IP_ADDRESS=$(aws ec2 describe-instances \
  --filters "Name=tag-value,Values=$stack" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' | tr -d '"')
if [ -z "$BASTION_IP_ADDRESS" ] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} Unable to determine the Bastion Host IP Address"
  exit 1
fi

echo "${GREEN_ON}√${COLOR_OFF} Retrieving the Bastion Host Instance ID"
export INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag-value,Values=$stack" \
  --query 'Reservations[0].Instances[0].InstanceId' | tr -d '"')
  
if [ -z "$INSTANCE_ID" ] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} Unable to determine the Bastion Host Instance ID"
  exit 1
fi

echo "${GREEN_ON}√${COLOR_OFF} Retrieving the Bastion Host Instance Availability Zone"
export INSTANCE_AZ=$(aws ec2 describe-instances \
  --filters "Name=tag-value,Values=$stack" \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' | tr -d '"')
if [ -z "$INSTANCE_AZ" ] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} Unable to determine the Bastion Host AZ"
  exit 1
fi

echo "${GREEN_ON}√${COLOR_OFF} Retrieving the Bastion Host Region"
export INSTANCE_REGION=$(echo $INSTANCE_AZ | sed 's/.$//')
if [ -z "$BASTION_IP_ADDRESS" ] ; then
  echo -e "\n\n${RED_ON}✘ Error!${COLOR_OFF} Unable to determine the Bastion Host Region"
  exit 1
fi

echo "${GREEN_ON}√${COLOR_OFF} Transferring the SSH key to the Bastion Host"
aws ec2-instance-connect send-ssh-public-key \
  --region $INSTANCE_REGION \
  --instance-id $INSTANCE_ID \
  --availability-zone $INSTANCE_AZ \
  --instance-os-user ec2-user \
  --ssh-public-key file://$ssh_key.pub

echo -e "\n\n${GREEN_ON}√ Opening SSH Tunnel!${COLOR_OFF}"
echo "You may now connect to the remote database using SSH tunneling"
echo "RDS Endpoint: ${GREEN_ON}$RDS_ENDPOINT${COLOR_OFF}"
echo "RDS Credentials: From Secrets Manager"
echo "SSH Tunneling Host: ${GREEN_ON}$BASTION_IP_ADDRESS${COLOR_OFF}"
echo "SSH Tunneling Username: ${GREEN_ON}ec2-user${COLOR_OFF}"
echo "SSH Tunneling key: ${GREEN_ON}$ssh_key${COLOR_OFF}"
echo "You must connect within 60 seconds"
