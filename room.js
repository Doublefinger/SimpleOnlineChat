/**
 * Created by Doublefinger on 4/9/16.
 */

function Room(name, owner, password) {
    this.name = name;
    this.owner = owner;
    this.password = password;
    this.people = [];
    this.blacklist = [];
};

Room.prototype.addPerson = function(personID) {
    this.people.push(personID);
};

Room.prototype.removePerson = function(personID) {
    for(var i = 0; i < this.people.length; i++){
        if(this.people[i] === personID){
            this.people.remove(i);
            break;
        }
    }
};

Room.prototype.isEmpty = function() {
    return this.people.length == 0;
};

Room.prototype.addToBlacklist = function(personID) {
    this.blacklist.push(personID);
}

Room.prototype.transferOwner = function(personID) {
    if(personID){
        for(var i = 0; i < this.people.length; i++) {
            if(this.people[i] == personID) {
                this.owner = this.people[i];
                return personID;
            }
        }
        return null;
    }
    if(this.people.length > 0) {
        this.owner = this.people[0];
        return this.owner;
    }
    return null;
};

Room.prototype.inBlacklist = function(personID) {
    for(var i = 0; i < this.blacklist.length; i++) {
        if(this.blacklist[i] == personID) {
            return true;
        }
    }
    return false;
};

Room.prototype.checkPassword = function(password) {
    if(this.password){
        return this.password === password;
    }
    return true;
};

module.exports = Room;