package com.example.springbootwebapp.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.example.springbootwebapp.model.Contact;
import com.example.springbootwebapp.repository.ContactRepository;

@Service
public class ContactService {
	
	@Autowired
	private ContactRepository contactRepository;
	
	public ResponseEntity<List<Contact>> getAllContacts() {
		return new ResponseEntity<>(contactRepository.findAll(), HttpStatus.OK);
	}
	
	public HttpStatus addContact(Contact contact) {
		contactRepository.save(contact);
		return HttpStatus.ACCEPTED;
	}
	
	public ResponseEntity<List<Contact>> getContactsByName(String name) {
		return new ResponseEntity<>(contactRepository.findByName(name), HttpStatus.OK);
	}
}
