package com.example.springbootwebapp.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.springbootwebapp.model.Contact;
import com.example.springbootwebapp.service.ContactService;

@RestController
public class AppController {
	
	@Autowired
	private ContactService contactService;
	
	@GetMapping("/getAllContacts")
	public ResponseEntity<List<Contact>> getAllContacts() {
		return contactService.getAllContacts();
	}
	
	@PostMapping("/addContact")
	public HttpStatus addContact(@RequestBody Contact contact) {
		return contactService.addContact(contact);
	}
	
	@GetMapping("/getContactsByName")
	public ResponseEntity<List<Contact>> getContactsByName(@RequestParam String name) {
		return contactService.getContactsByName(name);
	}
}