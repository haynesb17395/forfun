package com.example.springbootwebapp.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.example.springbootwebapp.model.Contact;

public interface ContactRepository extends MongoRepository<Contact, String> {

	List<Contact> findByName(String name);
	
}
